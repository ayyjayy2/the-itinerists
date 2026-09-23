import { Injectable, signal, inject, Injector, runInInjectionContext, effect } from '@angular/core';
import {
  Firestore, collection, doc, onSnapshot, setDoc, updateDoc, Unsubscribe,
} from '@angular/fire/firestore';
import { PackingItem, PackingSuggestion } from '../models/trip.models';
import { guessPackingCategory, newItemsForPacking, PackingSync } from '../utils/packing-match';
import { UserService } from './user.service';
import { TripContextService } from './trip-context.service';

export const DEFAULT_PACKING_CATEGORIES = ['Clothes', 'Shoes', 'Accessories', 'Outerwear', 'Toiletries'];

/**
 * Per-trip packing, in Firestore (TP-21) so it syncs across devices:
 * - `trips/{tripId}/packing/{uid}` — this member's `{ items, categories }`.
 * - `trips/{tripId}/packingSuggestions/{id}` — suggestions between members.
 * Re-subscribes whenever the active trip or signed-in user changes.
 */
@Injectable({ providedIn: 'root' })
export class PackingService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private userService = inject(UserService);
  private tripContext = inject(TripContextService);

  private _items       = signal<PackingItem[]>([]);
  private _suggestions = signal<PackingSuggestion[]>([]);
  private _categories  = signal<string[]>([...DEFAULT_PACKING_CATEGORIES]);

  readonly items       = this._items.asReadonly();
  readonly suggestions = this._suggestions.asReadonly();
  readonly categories  = this._categories.asReadonly();

  private unsubs: Unsubscribe[] = [];

  constructor() {
    effect(() => this.subscribe(this.tripContext.activeTripId(), this.userService.firestoreUser()?.uid));
  }

  /** Retained for AppComponent compatibility — the constructor effect drives loading. */
  init(): void { /* no-op */ }

  private packingRef(tripId: string, uid: string) {
    return doc(this.firestore, 'trips', tripId, 'packing', uid);
  }

  private subscribe(tripId: string | null, uid: string | undefined): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
    if (!tripId || !uid) {
      this._items.set([]); this._suggestions.set([]); this._categories.set([...DEFAULT_PACKING_CATEGORIES]);
      return;
    }
    runInInjectionContext(this.injector, () => {
      this.unsubs.push(
        onSnapshot(this.packingRef(tripId, uid), snap => {
          const data = snap.exists() ? snap.data() : {};
          this._items.set((data['items'] as PackingItem[]) ?? []);
          this._categories.set(this.mergeCategories((data['categories'] as string[]) ?? []));
        }),
        onSnapshot(collection(this.firestore, 'trips', tripId, 'packingSuggestions'), snap => {
          this._suggestions.set(snap.docs.map(d => d.data() as PackingSuggestion));
        }),
      );
    });
  }

  private mergeCategories(custom: string[]): string[] {
    return [...DEFAULT_PACKING_CATEGORIES, ...custom.filter(c => !DEFAULT_PACKING_CATEGORIES.includes(c))];
  }

  // ── Items ────────────────────────────────────────────────────────────────────

  addItem(label: string, category = 'Clothes'): void {
    const item: PackingItem = { id: crypto.randomUUID(), label, packed: false, addedAt: Date.now(), category };
    this.saveItems([...this._items(), item]);
  }

  /**
   * Put an outfit's newly added items on this member's packing list, skipping
   * anything already on it as the exact same text (case and surrounding
   * whitespace aside). Items that were already in the outfit before this save
   * are left alone, so a deliberate removal from the packing list is not
   * undone. Returns what was added and what was skipped.
   */
  addFromOutfit(outfitItems: readonly string[], previousOutfitItems: readonly string[] = []): PackingSync {
    const sync = newItemsForPacking(outfitItems, previousOutfitItems, this._items().map(i => i.label));
    if (sync.added.length) {
      const now = Date.now();
      const items: PackingItem[] = sync.added.map(label => ({
        id: crypto.randomUUID(), label, packed: false, addedAt: now, category: guessPackingCategory(label),
      }));
      this.saveItems([...this._items(), ...items]);
    }
    return sync;
  }

  toggleItem(id: string): void {
    this.saveItems(this._items().map(i => (i.id === id ? { ...i, packed: !i.packed } : i)));
  }

  removeItem(id: string): void {
    this.saveItems(this._items().filter(i => i.id !== id));
  }

  private saveItems(items: PackingItem[]): void {
    const ref = this.myRef();
    if (!ref) return;
    this._items.set(items); // optimistic; the snapshot will confirm
    setDoc(ref, { items }, { merge: true })
      .catch(err => console.error('[PackingService] saveItems failed:', err));
  }

  addCategory(name: string): void {
    const trimmed = name.trim();
    const ref = this.myRef();
    if (!trimmed || !ref || this._categories().includes(trimmed)) return;
    const custom = [...this._categories().filter(c => !DEFAULT_PACKING_CATEGORIES.includes(c)), trimmed];
    this._categories.set(this.mergeCategories(custom));
    setDoc(ref, { categories: custom }, { merge: true })
      .catch(err => console.error('[PackingService] addCategory failed:', err));
  }

  // ── Suggestions ───────────────────────────────────────────────────────────────

  /** Pending suggestions addressed to the current user. */
  inboxSuggestions(): PackingSuggestion[] {
    const me = this.userService.currentUser()?.name ?? '';
    return this._suggestions().filter(s => s.to === me && s.status === 'pending');
  }

  /** Send a packing suggestion to another member. */
  sendSuggestion(toUser: string, item: string): void {
    const tripId = this.tripContext.activeTripId();
    if (!tripId) return;
    const me  = this.userService.currentUser()?.name ?? '';
    const ref = doc(collection(this.firestore, 'trips', tripId, 'packingSuggestions'));
    const suggestion: PackingSuggestion = {
      id: ref.id, from: me, to: toUser, item, sentAt: Date.now(), status: 'pending',
    };
    setDoc(ref, suggestion)
      .catch(err => console.error('[PackingService] sendSuggestion failed:', err));
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
    const tripId = this.tripContext.activeTripId();
    if (!tripId) return;
    updateDoc(doc(this.firestore, 'trips', tripId, 'packingSuggestions', id), { status })
      .catch(err => console.error('[PackingService] updateSuggestionStatus failed:', err));
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  /** The current user's packing doc ref for the active trip, or null. */
  private myRef() {
    const tripId = this.tripContext.activeTripId();
    const uid    = this.userService.firestoreUser()?.uid;
    return tripId && uid ? this.packingRef(tripId, uid) : null;
  }
}
