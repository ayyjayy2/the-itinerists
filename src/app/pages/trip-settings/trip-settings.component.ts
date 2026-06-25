import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { TripDoc, TripMember } from '../../models/trip.models';

interface CurrencyOption { code: string; label: string; }
interface HideablePage { key: string; label: string; icon: string; }

@Component({
  selector: 'app-trip-settings',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './trip-settings.component.html',
  styleUrl: './trip-settings.component.scss',
})
export class TripSettingsComponent {
  private tripService = inject(TripService);
  private userService = inject(UserService);
  private router      = inject(Router);

  readonly trip    = this.tripService.activeTrip;
  readonly members = this.tripService.activeMembers;

  readonly currencies: CurrencyOption[] = [
    { code: 'USD', label: 'USD — US Dollar' },
    { code: 'EUR', label: 'EUR — Euro' },
    { code: 'GBP', label: 'GBP — British Pound' },
    { code: 'CAD', label: 'CAD — Canadian Dollar' },
    { code: 'AUD', label: 'AUD — Australian Dollar' },
    { code: 'JPY', label: 'JPY — Japanese Yen' },
    { code: 'MXN', label: 'MXN — Mexican Peso' },
  ];

  /** Pages a member may hide from their own navigation (core pages stay). */
  readonly hideablePages: HideablePage[] = [
    { key: 'flights',        label: 'Flights',     icon: '✈️' },
    { key: 'accommodations', label: 'Stays',       icon: '🏨' },
    { key: 'expenses',       label: 'My Expenses', icon: '🧾' },
    { key: 'recs',           label: 'Recs',        icon: '🌸' },
    { key: 'packing',        label: 'Packing',     icon: '🧳' },
    { key: 'outfits',        label: 'Outfits',     icon: '👗' },
  ];

  // Editable form fields, seeded from the active trip.
  name = ''; destination = ''; startDate = ''; endDate = ''; currency = 'USD';
  private seededId: string | null = null;

  saving      = signal(false);
  savedOk     = signal(false);
  error       = signal('');
  inviteState = signal<'idle' | 'copying' | 'copied'>('idle');
  busyMember  = signal<string | null>(null);

  private readonly currentUid = computed(() => this.userService.firestoreUser()?.uid ?? '');
  readonly isOwner = computed(() =>
    this.members().find(m => m.uid === this.currentUid())?.role === 'owner');

  constructor() {
    // Seed the form whenever the active trip changes.
    effect(() => {
      const t = this.trip();
      if (t && t.id !== this.seededId) { this.seedForm(t); this.seededId = t.id; }
    });
  }

  private seedForm(t: TripDoc): void {
    this.name = t.name; this.destination = t.destination;
    this.startDate = t.startDate; this.endDate = t.endDate; this.currency = t.currency;
  }

  isMe(m: TripMember): boolean { return m.uid === this.currentUid(); }
  canRemove(m: TripMember): boolean { return m.role !== 'owner' && !this.isMe(m); }

  async saveDetails(): Promise<void> {
    const t = this.trip();
    if (!t) return;
    const name = this.name.trim(), destination = this.destination.trim();
    if (!name)                            { this.error.set('Please enter a trip name.'); return; }
    if (!destination)                     { this.error.set('Please enter a destination.'); return; }
    if (!this.startDate || !this.endDate) { this.error.set('Please choose start and end dates.'); return; }
    if (this.endDate < this.startDate)    { this.error.set('End date can’t be before the start date.'); return; }

    this.error.set(''); this.savedOk.set(false); this.saving.set(true);
    try {
      await this.tripService.updateTrip(t.id, {
        name, destination, startDate: this.startDate, endDate: this.endDate, currency: this.currency,
      });
      this.savedOk.set(true);
      setTimeout(() => this.savedOk.set(false), 2500);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Could not save changes.');
    } finally {
      this.saving.set(false);
    }
  }

  async copyInvite(): Promise<void> {
    const t = this.trip();
    if (!t) return;
    this.inviteState.set('copying');
    try {
      const code = await this.tripService.generateInvite(t.id);
      await navigator.clipboard.writeText(`${window.location.origin}/join?code=${code}`);
      this.inviteState.set('copied');
      setTimeout(() => this.inviteState.set('idle'), 2500);
    } catch {
      this.inviteState.set('idle');
      this.error.set('Could not create an invite link.');
    }
  }

  async remove(m: TripMember): Promise<void> {
    const t = this.trip();
    if (!t || !this.canRemove(m)) return;
    if (!confirm(`Remove ${m.displayName} from this trip?`)) return;
    this.busyMember.set(m.uid);
    try {
      await this.tripService.removeMember(t.id, m.uid);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Could not remove member.');
    } finally {
      this.busyMember.set(null);
    }
  }

  async leave(): Promise<void> {
    const t = this.trip();
    if (!t) return;
    if (!confirm(`Leave "${t.name}"? You'll need a new invite to rejoin.`)) return;
    try {
      await this.tripService.leaveTrip(t.id);
      this.router.navigate(['/trips']);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Could not leave the trip.');
    }
  }

  isHidden(key: string): boolean { return this.tripService.hiddenPages().includes(key); }

  async togglePage(key: string): Promise<void> {
    const t = this.trip();
    if (!t) return;
    const current = this.tripService.hiddenPages();
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    try {
      await this.tripService.setHiddenPages(t.id, next);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Could not update your menu.');
    }
  }

  async toggleArchive(): Promise<void> {
    const t = this.trip();
    if (!t) return;
    try {
      await this.tripService.archiveTrip(t.id, !t.archived);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Could not update the trip.');
    }
  }
}
