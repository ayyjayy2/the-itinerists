import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecsService } from '../../services/recs.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { Rec, RecDoc } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';
import { NoTripStateComponent } from '../../shared/no-trip-state/no-trip-state.component';
import { tripDestinations, activeLeg, localTodayISO } from '../../utils/trip-destinations';
import { groupRecsByCategory, groupRecsByDestination, ANYWHERE, DestinationSection } from '../../utils/rec-groups';

const CATEGORIES = ['Food', 'Drink', 'Places', 'Activities', 'Tips', 'Culture'];

@Component({
  selector: 'app-recs',
  imports: [IconComponent, NoTripStateComponent, CommonModule, FormsModule],
  templateUrl: './recs.component.html',
  styleUrl: './recs.component.scss'
})
export class RecsComponent {
  recsService = inject(RecsService);
  userService = inject(UserService);
  tripService = inject(TripService);
  readonly hasActiveTrip = computed(() => this.tripService.activeTrip() !== null);

  currentUser = this.userService.currentUser;
  isAdmin     = this.userService.isAdmin;

  selectedCategory    = signal<string>('All');
  selectedDestination = signal<string>('All');
  showForm            = signal(false);

  readonly categories = ['All', ...CATEGORIES];
  readonly anywhere   = ANYWHERE;

  // ── Destinations (multi-leg trips group recs by place) ─────────────────────
  readonly legs = computed((): string[] => {
    const t = this.tripService.activeTrip();
    return t ? tripDestinations(t).map(d => d.destination) : [];
  });
  readonly isMultiDestination = computed(() => this.legs().length > 1);

  /** The leg to preselect for a new rec: the one happening now, else the next up. */
  private defaultDestination(): string {
    const t = this.tripService.activeTrip();
    if (!t || !this.isMultiDestination()) return '';
    return activeLeg(tripDestinations(t), localTodayISO()).destination;
  }

  form: Rec = { category: 'Tips', title: '', description: '', extra: '', destination: '' };
  customCategory    = '';
  useCustomCategory = false;

  openForm(): void {
    this.form.destination = this.defaultDestination();
    this.showForm.set(true);
  }

  // Recs are entirely user-added, per trip (no hardcoded seed content).
  readonly allRecs = computed((): RecDoc[] => this.recsService.recs());

  readonly filtered = computed((): RecDoc[] => {
    const cat  = this.selectedCategory();
    const dest = this.selectedDestination();
    return this.allRecs().filter(r =>
      (cat === 'All' || r.category === cat) &&
      (dest === 'All' || !this.isMultiDestination() || this.sectionFor(r) === dest));
  });

  /** Which section a rec belongs to: its leg, or Anywhere when unset / no longer a leg. */
  private sectionFor(r: RecDoc): string {
    const k = (r.destination ?? '').trim().toLowerCase();
    return this.legs().find(l => l.trim().toLowerCase() === k) ?? ANYWHERE;
  }

  /** Single-destination trips: one flat list of category groups. */
  readonly groupedByCat = computed(() =>
    groupRecsByCategory(this.filtered(), CATEGORIES));

  /** Multi-destination trips: a section per leg (leg order), categories inside, Anywhere last. */
  readonly sections = computed((): DestinationSection<RecDoc>[] =>
    groupRecsByDestination(this.filtered(), this.legs(), CATEGORIES));

  /** Line-icon + Dusk Garden colour per category (falls back for custom ones). */
  categoryMeta(cat: string): { icon: string; color: string } {
    const map: Record<string, { icon: string; color: string }> = {
      'Food':       { icon: 'food',     color: 'var(--accent-dark)' },
      'Drink':      { icon: 'drink',    color: 'var(--highlight-dk)' },
      'Places':     { icon: 'pin',      color: 'var(--primary-dark)' },
      'Activities': { icon: 'activity', color: 'var(--lavender-dark)' },
      'Tips':       { icon: 'sparkle',  color: 'var(--accent-dark)' },
      'Culture':    { icon: 'culture',  color: 'var(--highlight-dk)' },
    };
    return map[cat] ?? { icon: 'star', color: 'var(--primary-dark)' };
  }

  toggleCustomCategory(val: boolean): void {
    this.useCustomCategory = val;
    if (!val) this.customCategory = '';
  }

  async addRec(): Promise<void> {
    const category = this.useCustomCategory ? this.customCategory.trim() : this.form.category;
    if (!this.form.title.trim() || !category) return;
    const destination = this.isMultiDestination() ? this.form.destination?.trim() : '';
    await this.recsService.addRec({
      category,
      title:       this.form.title.trim(),
      description: this.form.description.trim(),
      extra:       this.form.extra.trim(),
      ...(destination ? { destination } : {}),
      addedByUid:  this.currentUser()?.uid ?? '',
      createdAt:   Date.now(),
    });
    this.form = { category: 'Tips', title: '', description: '', extra: '', destination: '' };
    this.customCategory   = '';
    this.useCustomCategory = false;
    this.showForm.set(false);
  }

  // ── Inline editing (same people who may delete: the author, or an app admin) ──
  editingId = signal<string | null>(null);
  editForm: Rec = { category: 'Tips', title: '', description: '', extra: '', destination: '' };
  editCustomCategory    = '';
  editUseCustomCategory = false;

  /** Categories offered when editing: the defaults plus any custom ones already used on this trip. */
  readonly editCategoryOptions = computed((): string[] => {
    const used = new Set(this.allRecs().map(r => r.category));
    return [...CATEGORIES, ...[...used].filter(c => !CATEGORIES.includes(c)).sort()];
  });

  canEdit(rec: RecDoc): boolean { return this.canDelete(rec); }
  isEditing(rec: RecDoc): boolean { return this.editingId() === rec.id; }

  startEdit(rec: RecDoc): void {
    if (!this.canEdit(rec)) return;
    this.showForm.set(false);
    this.editForm = {
      category: rec.category, title: rec.title, description: rec.description,
      extra: rec.extra, destination: rec.destination ?? '',
    };
    this.editCustomCategory    = '';
    this.editUseCustomCategory = false;
    this.editingId.set(rec.id);
  }

  cancelEdit(): void { this.editingId.set(null); }

  toggleEditCustomCategory(val: boolean): void {
    this.editUseCustomCategory = val;
    if (!val) this.editCustomCategory = '';
  }

  async saveEdit(): Promise<void> {
    const id = this.editingId();
    const category = this.editUseCustomCategory ? this.editCustomCategory.trim() : this.editForm.category;
    if (!id || !this.editForm.title.trim() || !category) return;
    const destination = this.isMultiDestination() ? (this.editForm.destination ?? '').trim() : '';
    await this.recsService.updateRec(id, {
      category,
      title:       this.editForm.title.trim(),
      description: this.editForm.description.trim(),
      extra:       this.editForm.extra.trim(),
      destination,
    });
    this.editingId.set(null);
  }

  canDelete(rec: RecDoc): boolean {
    if (!rec.id) return false;
    if (this.isAdmin()) return true;
    return rec.addedByUid === this.currentUser()?.uid;
  }

  async deleteRec(id: string): Promise<void> {
    await this.recsService.deleteRec(id);
  }

  setCategory(cat: string): void { this.selectedCategory.set(cat); }
  setDestination(dest: string): void { this.selectedDestination.set(dest); }
}
