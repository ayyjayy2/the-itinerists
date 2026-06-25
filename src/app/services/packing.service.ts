import { Injectable, signal, inject } from '@angular/core';
import { PackingItem, PackingSuggestion } from '../models/trip.models';
import { UserService } from './user.service';

const ITEMS_KEY_PREFIX      = 'tripplanner_packing_items_';
const SUGGESTIONS_KEY       = 'tripplanner_packing_suggestions';
const CATEGORIES_KEY_PREFIX = 'tripplanner_packing_categories_';
export const DEFAULT_PACKING_CATEGORIES = ['Clothes', 'Shoes', 'Accessories', 'Outerwear', 'Toiletries'];

@Injectable({ providedIn: 'root' })
export class PackingService {
  private userService = inject(UserService);

  private _items       = signal<PackingItem[]>([]);
  private _suggestions = signal<PackingSuggestion[]>([]);
  private _categories  = signal<string[]>([...DEFAULT_PACKING_CATEGORIES]);

  readonly items       = this._items.asReadonly();
  readonly suggestions = this._suggestions.asReadonly();
  readonly categories  = this._categories.asReadonly();

  init(): void {
    this._items.set(this.loadItems());
    this._suggestions.set(this.loadSuggestions());
    this._categories.set(this.loadCategories());
  }

  // ── Items ────────────────────────────────────────────────────────────────────

  addItem(label: string, category = 'Clothes'): void {
    const item: PackingItem = {
      id: crypto.randomUUID(),
      label,
      packed: false,
      addedAt: Date.now(),
      category,
    };
    const updated = [...this._items(), item];
    this._items.set(updated);
    this.saveItems(updated);
  }

  toggleItem(id: string): void {
    const updated = this._items().map(i =>
      i.id === id ? { ...i, packed: !i.packed } : i
    );
    this._items.set(updated);
    this.saveItems(updated);
  }

  removeItem(id: string): void {
    const updated = this._items().filter(i => i.id !== id);
    this._items.set(updated);
    this.saveItems(updated);
  }

  // ── Suggestions ───────────────────────────────────────────────────────────────

  /** Pending suggestions for current user (received from others) */
  inboxSuggestions(): PackingSuggestion[] {
    const me = this.userService.currentUser()?.name ?? '';
    return this._suggestions().filter(s => s.to === me && s.status === 'pending');
  }

  /** Send a suggestion to another user (posts to Apps Script + saves locally) */
  sendSuggestion(toUser: string, item: string): void {
    const me = this.userService.currentUser()?.name ?? '';
    const suggestion: PackingSuggestion = {
      id: crypto.randomUUID(),
      from: me,
      to: toUser,
      item,
      sentAt: Date.now(),
      status: 'pending'
    };

    // Save locally
    const updated = [...this._suggestions(), suggestion];
    this._suggestions.set(updated);
    this.saveSuggestions(updated);
  }

  acceptSuggestion(id: string): void {
    const suggestion = this._suggestions().find(s => s.id === id);
    if (suggestion) {
      this.addItem(suggestion.item);
      this.updateSuggestionStatus(id, 'accepted');
    }
  }

  declineSuggestion(id: string): void {
    this.updateSuggestionStatus(id, 'declined');
  }

  private updateSuggestionStatus(id: string, status: 'accepted' | 'declined'): void {
    const updated = this._suggestions().map(s =>
      s.id === id ? { ...s, status } : s
    );
    this._suggestions.set(updated);
    this.saveSuggestions(updated);
  }

  addCategory(name: string): void {
    const trimmed = name.trim();
    if (!trimmed || this._categories().includes(trimmed)) return;
    const updated = [...this._categories(), trimmed];
    this._categories.set(updated);
    this.saveCustomCategories(updated);
  }

  // ── Storage ───────────────────────────────────────────────────────────────────

  private userKey(): string {
    return this.userService.currentUser()?.name ?? 'unknown';
  }

  private itemsKey(): string {
    return ITEMS_KEY_PREFIX + this.userKey();
  }

  private loadCategories(): string[] {
    try {
      const raw    = localStorage.getItem(CATEGORIES_KEY_PREFIX + this.userKey());
      const custom = raw ? (JSON.parse(raw) as string[]) : [];
      return [...DEFAULT_PACKING_CATEGORIES,
              ...custom.filter(c => !DEFAULT_PACKING_CATEGORIES.includes(c))];
    } catch { return [...DEFAULT_PACKING_CATEGORIES]; }
  }

  private saveCustomCategories(all: string[]): void {
    const custom = all.filter(c => !DEFAULT_PACKING_CATEGORIES.includes(c));
    localStorage.setItem(CATEGORIES_KEY_PREFIX + this.userKey(), JSON.stringify(custom));
  }

  private loadItems(): PackingItem[] {
    try {
      const raw = localStorage.getItem(this.itemsKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveItems(items: PackingItem[]): void {
    localStorage.setItem(this.itemsKey(), JSON.stringify(items));
  }

  private loadSuggestions(): PackingSuggestion[] {
    try {
      const raw = localStorage.getItem(SUGGESTIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveSuggestions(items: PackingSuggestion[]): void {
    localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(items));
  }
}
