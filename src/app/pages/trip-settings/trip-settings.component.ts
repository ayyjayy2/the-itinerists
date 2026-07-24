import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { ThemeService } from '../../services/theme.service';
import { TripDoc, TripDestination, TripMember, ActivityLogEntry } from '../../models/trip.models';
import { tripDestinations, tripSummary, buildEditedDestinations, DestinationEdit } from '../../utils/trip-destinations';
import { IconComponent } from '../../shared/icon/icon.component';
import { CurrencySelectComponent } from '../../shared/currency-select/currency-select.component';

interface CurrencyOption { code: string; label: string; }
interface HideablePage { key: string; label: string; icon: string; }

/** One editable destination row, remembering the leg it was loaded from. */
interface DestRow {
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
  original?: TripDestination;
}

@Component({
  selector: 'app-trip-settings',
  imports: [IconComponent, CurrencySelectComponent, CommonModule, FormsModule, RouterLink],
  templateUrl: './trip-settings.component.html',
  styleUrl: './trip-settings.component.scss',
})
export class TripSettingsComponent {
  private tripService = inject(TripService);
  private userService = inject(UserService);
  private themeService = inject(ThemeService);
  private router      = inject(Router);

  // Appearance (DP2-9) — multi-theme picker (Light / Medium / Dark).
  readonly themes = this.themeService.themes;
  readonly currentTheme = this.themeService.theme;
  setTheme(id: string): void { this.themeService.set(id); }

  readonly trip     = this.tripService.activeTrip;
  readonly members  = this.tripService.activeMembers;
  readonly activity = this.tripService.activeActivity;

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
    { key: 'flights',        label: 'Flights',     icon: 'flights' },
    { key: 'accommodations', label: 'Stays',       icon: 'stays' },
    { key: 'expenses',       label: 'My Expenses', icon: 'expenses' },
    { key: 'recs',           label: 'Recs',        icon: 'recs' },
    { key: 'packing',        label: 'Packing',     icon: 'packing' },
    { key: 'outfits',        label: 'Outfits',     icon: 'outfits' },
  ];

  // Editable form fields, seeded from the active trip.
  name = ''; destination = ''; startDate = ''; endDate = ''; currency = 'USD';
  // Multi-destination editing.
  multiDest = false;
  destRows: DestRow[] = [];
  private seededId: string | null = null;

  saving      = signal(false);
  savedOk     = signal(false);
  error        = signal('');
  inviteState  = signal<'idle' | 'copying' | 'copied'>('idle');
  busyMember   = signal<string | null>(null);
  leaving        = signal(false);
  removeConfirmOpen = signal(false);
  transferTarget = '';

  private readonly currentUid = computed(() => this.userService.firestoreUser()?.uid ?? '');
  readonly isOwner = computed(() =>
    this.members().find(m => m.uid === this.currentUid())?.role === 'owner');

  /** Members eligible to receive ownership (everyone but the current owner). */
  readonly otherMembers = computed(() => this.members().filter(m => m.uid !== this.currentUid()));
  readonly isLastMember = computed(() => this.members().length <= 1);
  private readonly currentMemberUids = computed(() => new Set(this.members().map(m => m.uid)));

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
    // Seed the destination rows from the trip's legs; open in multi mode when
    // the trip already has more than one destination.
    const legs = tripDestinations(t);
    this.destRows = legs.map(leg => ({
      destination: leg.destination,
      startDate: leg.startDate,
      endDate: leg.endDate,
      currency: leg.currency,
      original: leg,
    }));
    this.multiDest = legs.length > 1;
  }

  // ── Multi-destination editing ────────────────────────────────────────────────
  /** The toggle can't be switched off while more than one leg exists. */
  get multiToggleLocked(): boolean { return this.destRows.length > 1; }

  toggleMulti(on: boolean): void {
    if (this.multiToggleLocked) { this.multiDest = true; return; } // locked on
    this.multiDest = on;
    if (on && this.destRows.length === 0) {
      this.destRows = [{ destination: this.destination, startDate: this.startDate, endDate: this.endDate, currency: this.currency }];
    }
  }

  addDestination(): void {
    this.destRows.push({ destination: '', startDate: '', endDate: '', currency: 'USD' });
  }

  removeDestination(index: number): void {
    if (this.destRows.length > 1) this.destRows.splice(index, 1);
    // Dropping back to a single leg unlocks the toggle but stays in multi view
    // until the user chooses to collapse.
  }

  isMe(m: TripMember): boolean { return m.uid === this.currentUid(); }
  canRemove(m: TripMember): boolean { return m.role !== 'owner' && !this.isMe(m); }

  async saveDetails(): Promise<void> {
    const t = this.trip();
    if (!t) return;
    const name = this.name.trim();
    if (!name) { this.error.set('Please enter a trip name.'); return; }

    // Assemble the destination rows to validate + persist (single mode = one row).
    const rows: DestinationEdit[] = this.multiDest
      ? this.destRows.map(r => ({ destination: r.destination, startDate: r.startDate, endDate: r.endDate, currency: r.currency, original: r.original }))
      : [{ destination: this.destination, startDate: this.startDate, endDate: this.endDate, currency: this.currency, original: tripDestinations(t)[0] }];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const where = this.multiDest ? `Destination ${i + 1}: ` : '';
      if (!r.destination.trim())    { this.error.set(`${where}please enter a destination.`); return; }
      if (!r.startDate || !r.endDate) { this.error.set(`${where}please choose start and end dates.`); return; }
      if (r.endDate < r.startDate)    { this.error.set(`${where}end date can’t be before the start date.`); return; }
    }

    const destinations = buildEditedDestinations(rows);
    const patch: Parameters<typeof this.tripService.updateTrip>[1] = { name, ...tripSummary(destinations), destinations };

    this.error.set(''); this.savedOk.set(false); this.saving.set(true);
    try {
      await this.tripService.updateTrip(t.id, patch);
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

  /** Open the remove-trip confirmation modal (TP-24). */
  openRemoveConfirm(): void { this.removeConfirmOpen.set(true); }
  cancelRemove(): void { this.removeConfirmOpen.set(false); }

  /** Confirmed removal: per-account. Sole member → deletes the trip + data. */
  async confirmRemove(): Promise<void> {
    const t = this.trip();
    if (!t) return;
    this.leaving.set(true);
    try {
      await this.tripService.leaveTrip(t.id);
      this.removeConfirmOpen.set(false);
      this.router.navigate(['/trips']);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Could not remove the trip.');
      this.leaving.set(false);
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

  /** Colour tone for the activity-log status dot (replaces status emoji). */
  activityTone(e: ActivityLogEntry): string {
    switch (e.action) {
      case 'member_removed':  return 'danger';
      case 'member_left':     return 'muted';
      case 'member_restored': return 'accent';
      default:                return 'ok';
    }
  }

  activityText(e: ActivityLogEntry): string {
    switch (e.action) {
      case 'member_added':
        return e.performedByUid === e.targetUid
          ? `${e.targetName} joined`
          : `${e.performedByName} added ${e.targetName}`;
      case 'member_removed':  return `${e.performedByName} removed ${e.targetName}`;
      case 'member_left':     return `${e.targetName} left`;
      case 'member_restored': return `${e.performedByName} restored ${e.targetName}`;
      default:                return '';
    }
  }

  /** Owner can restore a member from a member_removed entry if they're not currently on the trip. */
  canRestore(e: ActivityLogEntry): boolean {
    return this.isOwner() && e.action === 'member_removed' && !this.currentMemberUids().has(e.targetUid);
  }

  async restore(e: ActivityLogEntry): Promise<void> {
    const t = this.trip();
    if (!t) return;
    this.busyMember.set(e.targetUid);
    try {
      await this.tripService.restoreMember(t.id, e.targetUid);
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Could not restore member.');
    } finally {
      this.busyMember.set(null);
    }
  }

  async transfer(): Promise<void> {
    const t = this.trip();
    const to = this.transferTarget;
    if (!t || !to) return;
    const m = this.members().find(x => x.uid === to);
    if (!confirm(`Make ${m?.displayName ?? 'this member'} the owner? You'll become a regular member.`)) return;
    try {
      await this.tripService.transferOwnership(t.id, to);
      this.transferTarget = '';
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Could not transfer ownership.');
    }
  }


  relativeTime(ts: number): string {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); return `${d}d ago`;
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
