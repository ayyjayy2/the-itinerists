import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, onSnapshot, doc, setDoc } from '@angular/fire/firestore';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { TripContextService } from '../../services/trip-context.service';
import { FirestoreUser, TripConfig } from '../../models/trip.models';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, FormsModule],
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

  // Trip config
  tripStart     = '';
  tripEnd       = '';
  tripLocation  = '';
  tripLabel     = '';
  configSaving  = signal(false);
  configSuccess = signal(false);
  configError   = signal('');

  ngOnInit(): void {
    // Load members
    onSnapshot(collection(this.firestore, 'users'), snap => {
      this.members.set(
        snap.docs
          .map(d => d.data() as FirestoreUser)
          .sort((a, b) => a.createdAt - b.createdAt)
      );
    });

    // Load trip config
    onSnapshot(doc(this.firestore, 'app/tripConfig'), snap => {
      if (snap.exists()) {
        const cfg = snap.data() as TripConfig;
        this.tripStart    = cfg.startDate    ?? '';
        this.tripEnd      = cfg.endDate      ?? '';
        this.tripLocation = cfg.location     ?? '';
        this.tripLabel    = cfg.locationLabel ?? '';
      }
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

  async saveTripConfig(): Promise<void> {
    if (!this.tripStart || !this.tripEnd || !this.tripLocation) {
      this.configError.set('Please fill in all trip config fields.'); return;
    }
    this.configSaving.set(true);
    this.configError.set('');
    this.configSuccess.set(false);
    try {
      const cfg: TripConfig = {
        startDate:     this.tripStart,
        endDate:       this.tripEnd,
        location:      this.tripLocation,
        locationLabel: this.tripLabel || this.tripLocation,
      };
      await setDoc(doc(this.firestore, 'app/tripConfig'), cfg);
      this.configSuccess.set(true);
      setTimeout(() => this.configSuccess.set(false), 3000);
    } catch {
      this.configError.set('Failed to save trip config. Please try again.');
    } finally {
      this.configSaving.set(false);
    }
  }
}
