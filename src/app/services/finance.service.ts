import { Injectable, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { FinanceEntryDoc } from '../models/trip.models';

const PAID_KEY = 'savannah_paid_items';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);

  private _entries   = signal<FinanceEntryDoc[]>([]);
  private _paidItems = signal<Set<string>>(this.loadPaid());

  readonly entries   = this._entries.asReadonly();
  readonly paidItems = this._paidItems.asReadonly();

  init(): void {
    runInInjectionContext(this.injector, () => {
      onSnapshot(collection(this.firestore, 'financeEntries'), snap => {
        this._entries.set(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as FinanceEntryDoc))
            .sort((a, b) => a.date.localeCompare(b.date))
        );
      });
    });
  }

  async addEntry(entry: Omit<FinanceEntryDoc, 'id'>): Promise<void> {
    const ref = doc(collection(this.firestore, 'financeEntries'));
    await setDoc(ref, { ...entry, id: ref.id });
  }

  async updateEntry(id: string, updates: Partial<FinanceEntryDoc>): Promise<void> {
    const data = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await updateDoc(doc(this.firestore, 'financeEntries', id), data);
  }

  async deleteEntry(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'financeEntries', id));
  }

  togglePaidItem(key: string): void {
    const s = new Set(this._paidItems());
    s.has(key) ? s.delete(key) : s.add(key);
    this._paidItems.set(s);
    localStorage.setItem(PAID_KEY, JSON.stringify([...s]));
  }

  private loadPaid(): Set<string> {
    try {
      const raw = localStorage.getItem(PAID_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  }
}
