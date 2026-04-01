import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { Rec } from '../../models/trip.models';

const FIXED_CATEGORIES = ['Irish Words', 'Food', 'Drink', 'Currency', 'Tips', 'Places', 'Culture'];

@Component({
  selector: 'app-recs',
  imports: [CommonModule, FormsModule],
  templateUrl: './recs.component.html',
  styleUrl: './recs.component.scss'
})
export class RecsComponent {
  dataService = inject(DataService);

  selectedCategory = signal<string>('All');
  showForm = signal(false);

  form: Omit<Rec, never> = {
    category: 'Tips',
    title: '',
    description: '',
    extra: '',
  };
  customCategory = '';
  useCustomCategory = false;

  allRecs = computed(() => this.dataService.data()?.recs ?? []);

  categories = computed(() => {
    const fromData = new Set(this.allRecs().map(r => r.category));
    const merged = new Set([...FIXED_CATEGORIES, ...fromData]);
    return ['All', ...Array.from(merged)];
  });

  formCategories = computed(() => {
    const fromData = new Set(this.allRecs().map(r => r.category));
    return [...new Set([...FIXED_CATEGORIES, ...fromData])];
  });

  filtered = computed(() => {
    const cat = this.selectedCategory();
    return cat === 'All' ? this.allRecs() : this.allRecs().filter(r => r.category === cat);
  });

  groupedByCat = computed(() => {
    const groups: Record<string, Rec[]> = {};
    for (const r of this.filtered()) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    }
    return Object.entries(groups);
  });

  categoryIcon(cat: string): string {
    const map: Record<string, string> = {
      'Irish Words': '🗣️',
      'Food': '🍽️',
      'Drink': '🍺',
      'Currency': '💶',
      'Tips': '💡',
      'Places': '📍',
      'Culture': '🎭'
    };
    return map[cat] ?? '☘️';
  }

  toggleCustomCategory(val: boolean): void {
    this.useCustomCategory = val;
    if (!val) this.customCategory = '';
  }

  addRec(): void {
    const category = this.useCustomCategory
      ? this.customCategory.trim()
      : this.form.category;
    if (!this.form.title.trim() || !category) return;

    this.dataService.addRec({
      category,
      title: this.form.title.trim(),
      description: this.form.description.trim(),
      extra: this.form.extra.trim(),
    });

    this.form = { category: 'Tips', title: '', description: '', extra: '' };
    this.customCategory = '';
    this.useCustomCategory = false;
    this.showForm.set(false);
  }

  setCategory(cat: string): void { this.selectedCategory.set(cat); }
  refresh(): void { this.dataService.refresh(); }
}
