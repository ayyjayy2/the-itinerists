import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecsService } from '../../services/recs.service';
import { UserService } from '../../services/user.service';
import { Rec, RecDoc } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';

const CATEGORIES = ['Food', 'Drink', 'Places', 'Activities', 'Tips', 'Culture'];

type GroupedRecs = [string, RecDoc[]][];

@Component({
  selector: 'app-recs',
  imports: [IconComponent, CommonModule, FormsModule],
  templateUrl: './recs.component.html',
  styleUrl: './recs.component.scss'
})
export class RecsComponent {
  recsService = inject(RecsService);
  userService = inject(UserService);

  currentUser = this.userService.currentUser;
  isAdmin     = this.userService.isAdmin;

  selectedCategory = signal<string>('All');
  showForm         = signal(false);

  readonly categories = ['All', ...CATEGORIES];

  form: Omit<Rec, never> = { category: 'Tips', title: '', description: '', extra: '' };
  customCategory    = '';
  useCustomCategory = false;

  // Recs are entirely user-added, per trip (no hardcoded seed content).
  readonly allRecs = computed((): RecDoc[] => this.recsService.recs());

  readonly filtered = computed((): RecDoc[] => {
    const cat = this.selectedCategory();
    return cat === 'All' ? this.allRecs() : this.allRecs().filter(r => r.category === cat);
  });

  readonly groupedByCat = computed((): GroupedRecs => {
    const order = [...CATEGORIES];
    const groups: Record<string, RecDoc[]> = {};
    for (const r of this.filtered()) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      const ai = order.indexOf(a), bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  });

  categoryIcon(cat: string): string {
    const map: Record<string, string> = {
      'Food':       '🍽️',
      'Drink':      '🍹',
      'Places':     '📍',
      'Activities': '🌿',
      'Tips':       '💡',
      'Culture':    '🎭',
    };
    return map[cat] ?? '⭐';
  }

  toggleCustomCategory(val: boolean): void {
    this.useCustomCategory = val;
    if (!val) this.customCategory = '';
  }

  async addRec(): Promise<void> {
    const category = this.useCustomCategory ? this.customCategory.trim() : this.form.category;
    if (!this.form.title.trim() || !category) return;
    await this.recsService.addRec({
      category,
      title:       this.form.title.trim(),
      description: this.form.description.trim(),
      extra:       this.form.extra.trim(),
      addedByUid:  this.currentUser()?.uid ?? '',
      createdAt:   Date.now(),
    });
    this.form = { category: 'Tips', title: '', description: '', extra: '' };
    this.customCategory   = '';
    this.useCustomCategory = false;
    this.showForm.set(false);
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
}
