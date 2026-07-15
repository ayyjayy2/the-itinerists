import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { TripContextService } from '../../services/trip-context.service';
import { FirestoreUser } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-admin',
  imports: [IconComponent, CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  private firestore   = inject(Firestore);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private tripContext = inject(TripContextService);

  currentUser = this.userService.firestoreUser;

  // Members
  members        = signal<FirestoreUser[]>([]);
  removeError    = signal('');
  memberToRemove = signal<FirestoreUser | null>(null);

  // Invite
  inviteLink     = signal('');
  inviteLoading  = signal(false);
  inviteError    = signal('');
  inviteCopied   = signal(false);

  ngOnInit(): void {
    // Load members
    onSnapshot(collection(this.firestore, 'users'), snap => {
      this.members.set(
        snap.docs
          .map(d => d.data() as FirestoreUser)
          .sort((a, b) => a.createdAt - b.createdAt)
      );
    });
  }

  async generateInvite(): Promise<void> {
    const uid    = this.currentUser()?.uid;
    const tripId = this.tripContext.activeTripId();
    if (!uid) return;
    if (!tripId) {
      this.inviteError.set('Select a trip first — invites are per-trip.');
      return;
    }
    this.inviteLoading.set(true);
    this.inviteError.set('');
    this.inviteLink.set('');
    try {
      const code = await this.authService.generateInviteCode(uid, tripId);
      const url  = `${window.location.origin}/join?code=${code}`;
      this.inviteLink.set(url);
    } catch {
      this.inviteError.set('Failed to generate invite. Please try again.');
    } finally {
      this.inviteLoading.set(false);
    }
  }

  async copyInvite(): Promise<void> {
    await navigator.clipboard.writeText(this.inviteLink());
    this.inviteCopied.set(true);
    setTimeout(() => this.inviteCopied.set(false), 2000);
  }

  promptRemove(member: FirestoreUser): void {
    if (member.uid === this.currentUser()?.uid) {
      this.removeError.set("You can't remove yourself.");
      return;
    }
    this.removeError.set('');
    this.memberToRemove.set(member);
  }

  cancelRemove(): void {
    this.memberToRemove.set(null);
  }

  async confirmRemove(): Promise<void> {
    const member = this.memberToRemove();
    if (!member) return;
    this.memberToRemove.set(null);
    try {
      await this.authService.disableUser(member.uid);
    } catch {
      this.removeError.set('Failed to remove user. Please try again.');
    }
  }

}
