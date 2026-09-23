import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StaysService } from '../../services/stays.service';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { TripService } from '../../services/trip.service';
import { AccommodationDoc } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';
import { NoTripStateComponent } from '../../shared/no-trip-state/no-trip-state.component';
import { TimeInputComponent } from '../../shared/time-input/time-input.component';
import { Time12Pipe } from '../../shared/time12.pipe';
import { EmptyDateHintDirective } from '../../shared/empty-date-hint.directive';

@Component({
  selector: 'app-accommodations',
  imports: [IconComponent, NoTripStateComponent, CommonModule, FormsModule, TimeInputComponent, Time12Pipe, EmptyDateHintDirective],
  templateUrl: './accommodations.component.html',
  styleUrl: './accommodations.component.scss'
})
export class AccommodationsComponent {
  staysService = inject(StaysService);
  userService  = inject(UserService);
  usersService = inject(UsersService);
  tripService = inject(TripService);
  readonly hasActiveTrip = computed(() => this.tripService.activeTrip() !== null);

  currentUser = this.userService.currentUser;
  readonly tripUsers = this.usersService.tripUsers;

  showAll = signal<boolean>(false);

  // ── Edit state ──────────────────────────────────────────────────────────────
  editingId    = signal<string | null>(null);
  draft: Partial<AccommodationDoc> = {};
  editForWhoMap: Record<string, boolean> = {};

  // ── Add state ───────────────────────────────────────────────────────────────
  adding    = signal<boolean>(false);
  newDraft: Partial<AccommodationDoc> = {};
  addForWhoMap: Record<string, boolean> = {};

  // ── Filtered stays ──────────────────────────────────────────────────────────
  readonly displayedStays = computed(() => {
    const all  = this.showAll();
    const me   = this.currentUser()?.name ?? '';
    const stays = this.staysService.stays();
    if (all) return stays;
    return stays.filter(s =>
      s.forWho === 'All' || s.forWho.split(',').map(x => x.trim()).includes(me)
    );
  });

  // ── ForWho helpers ──────────────────────────────────────────────────────────
  private buildForWho(map: Record<string, boolean>): string {
    const users    = this.tripUsers();
    const selected = users.filter(u => map[u.name]).map(u => u.name);
    return selected.length === users.length ? 'All' : selected.join(', ');
  }

  private parseForWhoToMap(forWho: string): Record<string, boolean> {
    const names = forWho.split(',').map(s => s.trim());
    const map: Record<string, boolean> = {};
    for (const u of this.tripUsers()) {
      map[u.name] = forWho === 'All' || names.includes(u.name);
    }
    return map;
  }

  isAllForWhoSelected(map: Record<string, boolean>): boolean {
    return this.tripUsers().every(u => map[u.name]);
  }

  toggleAllForWho(map: Record<string, boolean>): void {
    const val = !this.isAllForWhoSelected(map);
    for (const u of this.tripUsers()) map[u.name] = val;
  }

  // ── Edit helpers ────────────────────────────────────────────────────────────
  isEditing(stay: AccommodationDoc): boolean { return this.editingId() === stay.id; }

  startEdit(stay: AccommodationDoc): void {
    this.adding.set(false);
    this.editingId.set(stay.id);
    this.draft = { ...stay };
    this.editForWhoMap = this.parseForWhoToMap(stay.forWho);
  }

  cancelEdit(): void { this.editingId.set(null); this.draft = {}; this.editForWhoMap = {}; }

  async saveEdit(original: AccommodationDoc): Promise<void> {
    if (!this.draft.name?.trim()) return;
    await this.staysService.updateStay(original.id, {
      ...this.draft,
      forWho: this.buildForWho(this.editForWhoMap),
    });
    this.cancelEdit();
  }

  async deleteStay(stay: AccommodationDoc): Promise<void> {
    await this.staysService.deleteStay(stay.id);
    this.cancelEdit();
  }

  // ── Add helpers ─────────────────────────────────────────────────────────────
  startAdd(): void {
    this.cancelEdit();
    this.adding.set(true);
    this.newDraft = { name: '', address: '', checkIn: '', checkOut: '', checkInTime: '', checkOutTime: '', notes: '', bookingRef: '', link: '' };
    this.addForWhoMap = this.parseForWhoToMap('All');
  }

  cancelAdd(): void { this.adding.set(false); this.newDraft = {}; this.addForWhoMap = {}; }

  async saveAdd(): Promise<void> {
    if (!this.newDraft.name?.trim()) return;
    await this.staysService.addStay({
      name:       this.newDraft.name       ?? '',
      address:    this.newDraft.address    ?? '',
      checkIn:    this.newDraft.checkIn    ?? '',
      checkOut:   this.newDraft.checkOut   ?? '',
      checkInTime:  this.newDraft.checkInTime  ?? '',
      checkOutTime: this.newDraft.checkOutTime ?? '',
      notes:      this.newDraft.notes      ?? '',
      bookingRef: this.newDraft.bookingRef ?? '',
      link:       this.newDraft.link       ?? '',
      forWho:     this.buildForWho(this.addForWhoMap),
      addedByUid: this.currentUser()?.uid  ?? '',
      createdAt:  Date.now(),
    });
    this.cancelAdd();
  }

  // ── Utility ─────────────────────────────────────────────────────────────────
  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  nightsBetween(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 0;
    const a = new Date(checkIn  + 'T00:00');
    const b = new Date(checkOut + 'T00:00');
    return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  }
}
