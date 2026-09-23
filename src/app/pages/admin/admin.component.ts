import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { TripService } from '../../services/trip.service';
import { TripMember } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';
import { AvatarGlyphComponent } from '../../shared/avatar-glyph/avatar-glyph.component';

/**
 * Trip admin — for the person who created (owns) the active trip. Lists that
 * trip's members, removes people from it, and issues invite links for it.
 * Scope is the trip, not the app: an account's global admin flag plays no
 * part here, and members who were invited rather than creating the trip
 * don't get this page.
 */
@Component({
  selector: 'app-admin',
  imports: [IconComponent, CommonModule, FormsModule, RouterLink, AvatarGlyphComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private tripService = inject(TripService);

  currentUser = this.userService.firestoreUser;
  readonly trip    = this.tripService.activeTrip;
  readonly isOwner = this.tripService.isActiveTripOwner;

  /** Owner first, then by join date. */
  readonly members = computed((): TripMember[] =>
    [...this.tripService.activeMembers()].sort((a, b) =>
      (a.role === 'owner' ? 0 : 1) - (b.role === 'owner' ? 0 : 1) || a.joinedAt - b.joinedAt));

  removeError    = signal('');
  memberToRemove = signal<TripMember | null>(null);

  // Invite
  inviteLink     = signal('');
  inviteLoading  = signal(false);
  inviteError    = signal('');
  inviteCopied   = signal(false);

  async generateInvite(): Promise<void> {
    const uid    = this.currentUser()?.uid;
    const tripId = this.trip()?.id;
    if (!uid || !tripId || !this.isOwner()) return;
    this.inviteLoading.set(true);
    this.inviteError.set('');
    this.inviteLink.set('');
    try {
      const code = await this.authService.generateInviteCode(uid, tripId);
      this.inviteLink.set(`${window.location.origin}/join?code=${code}`);
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

  canRemove(member: TripMember): boolean {
    return this.isOwner() && member.role !== 'owner' && member.uid !== this.currentUser()?.uid;
  }

  promptRemove(member: TripMember): void {
    if (!this.canRemove(member)) return;
    this.removeError.set('');
    this.memberToRemove.set(member);
  }

  cancelRemove(): void { this.memberToRemove.set(null); }

  /** Takes the person off this trip only; their account and other trips are untouched. */
  async confirmRemove(): Promise<void> {
    const member = this.memberToRemove();
    const tripId = this.trip()?.id;
    if (!member || !tripId) return;
    this.memberToRemove.set(null);
    try {
      await this.tripService.removeMember(tripId, member.uid);
    } catch (err) {
      this.removeError.set((err as Error)?.message || 'Failed to remove member. Please try again.');
    }
  }

  joined(ms: number): string {
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
