import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TripService } from '../../services/trip.service';
import { TripContextService } from '../../services/trip-context.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { TripDoc } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';
import { InvitePanelComponent } from '../../shared/invite-panel/invite-panel.component';
import { userMessage } from '../../utils/user-message';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

@Component({
  selector: 'app-my-trips',
  imports: [IconComponent, CommonModule, InvitePanelComponent],
  templateUrl: './my-trips.component.html',
  styleUrl: './my-trips.component.scss',
})
export class MyTripsComponent implements OnInit {
  private tripService = inject(TripService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private router      = inject(Router);
  private tripContext = inject(TripContextService);

  trips   = signal<TripDoc[]>([]);
  loading = signal(true);
  error   = signal('');

  invitingId  = signal<string | null>(null);
  copiedId    = signal<string | null>(null);
  /** Trip id → the invite just generated for it (code + link shown under the card). */
  openInvite = signal<{ tripId: string; code: string } | null>(null);
  inviteClosing = signal(false);
  inviteNotice  = signal<string | null>(null);   // trip id whose invite was just closed
  inviteError = signal('');

  async ngOnInit(): Promise<void> {
    const user = this.userService.firestoreUser();
    if (!user) { this.loading.set(false); return; }
    try {
      const trips = await this.tripService.getUserTrips(user.uid);
      trips.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
      this.trips.set(trips);
    } catch (e: unknown) {
      this.error.set(userMessage(e, 'Could not load your trips.'));
    } finally {
      this.loading.set(false);
    }
  }

  isActive(trip: TripDoc): boolean {
    return this.tripContext.activeTripId() === trip.id;
  }

  async open(trip: TripDoc): Promise<void> {
    await this.tripService.switchTrip(trip.id);
    this.router.navigate(['/home']);
  }

  newTrip(): void {
    this.router.navigate(['/trips/new']);
  }

  /** Generate a per-trip invite link and copy it to the clipboard (TP-11). */
  async invite(trip: TripDoc): Promise<void> {
    this.inviteError.set('');
    this.copiedId.set(null);
    this.inviteNotice.set(null);
    this.invitingId.set(trip.id);
    try {
      const code = await this.tripService.generateInvite(trip.id);
      this.openInvite.set({ tripId: trip.id, code });
      const url  = `${window.location.origin}/join?code=${code}`;
      await navigator.clipboard.writeText(url).catch(() => {/* panel still shows it */});
      this.copiedId.set(trip.id);
      setTimeout(() => this.copiedId.set(null), 2500);
    } catch (e: unknown) {
      this.inviteError.set(userMessage(e, 'Could not create an invite link.'));
    } finally {
      this.invitingId.set(null);
    }
  }

  async closeInvite(trip: TripDoc, code: string): Promise<void> {
    this.inviteClosing.set(true);
    this.inviteError.set('');
    try {
      await this.tripService.revokeInvite(trip.id, code);
      this.openInvite.set(null);
      this.inviteNotice.set(trip.id);
    } catch (e: unknown) {
      this.inviteError.set(userMessage(e, 'Could not close the invite. Please try again.'));
    } finally {
      this.inviteClosing.set(false);
    }
  }

  dateRange(t: TripDoc): string {
    return `${fmtDate(t.startDate)} – ${fmtDate(t.endDate)}`;
  }
}

/** "2026-10-01" → "Oct 1, 2026" */
function fmtDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return d;
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}
