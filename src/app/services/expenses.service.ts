import { Injectable, signal, inject } from '@angular/core';
import { Firestore, doc, onSnapshot, setDoc } from '@angular/fire/firestore';
import { Expense } from '../models/trip.models';
import { UserService } from './user.service';
import { sanitizeStrings } from '../utils/sanitize';
import { ErrorLoggerService } from './error-logger.service';

const STORAGE_KEY_PREFIX  = 'ireland_expenses_';
const BACKUP_KEY_PREFIX   = 'ireland_expenses_backup_';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private userService = inject(UserService);
  private firestore   = inject(Firestore);
  private _expenses   = signal<Expense[]>([]);
  private _unsubscribe: (() => void) | null = null;

  readonly expenses = this._expenses.asReadonly();

  init(): void {
    const user = this.userService.currentUser();
    if (!user) return;

    // Clean up any existing listener before creating a new one
    this._unsubscribe?.();

    const username  = user.name;
    const docRef    = doc(this.firestore, 'userExpenses', username);
    const localKey  = STORAGE_KEY_PREFIX + username;
    const backupKey = BACKUP_KEY_PREFIX + username;

    // One-time migration: pull any existing (pre-Firestore) localStorage data
    let localItems: Expense[] = [];
    try {
      const raw = localStorage.getItem(localKey);
      localItems = raw ? JSON.parse(raw) : [];
    } catch { /* ignore */ }

    // Fallback chain: localStorage backup → empty
    let backupItems: Expense[] = [];
    try {
      const raw = localStorage.getItem(backupKey);
      backupItems = raw ? JSON.parse(raw) : [];
    } catch { /* ignore */ }

    this._unsubscribe = onSnapshot(
      docRef,
      snap => {
        if (snap.exists()) {
          const items = (snap.data()['items'] ?? []) as Expense[];
          this._expenses.set(items);
          // Keep the backup in sync with the latest confirmed Firestore state
          this.writeBackup(backupKey, items);
          localStorage.removeItem(localKey);
        } else {
          // No Firestore doc — seed from legacy localStorage or backup, then clear legacy key
          const seed = localItems.length > 0 ? localItems : backupItems;
          if (seed.length > 0) {
            setDoc(docRef, { items: seed })
              .catch(err => console.error('[Expenses] Failed to seed Firestore from local data:', err));
            this._expenses.set(seed);
            this.writeBackup(backupKey, seed);
          } else {
            this._expenses.set([]);
          }
          localStorage.removeItem(localKey);
        }
      },
      err => {
        // Firestore unavailable — fall back to local backup so data isn't lost
        console.error('[Expenses] Snapshot error:', err);
        if (this._expenses().length === 0) {
          const fallback = backupItems.length > 0 ? backupItems : localItems;
          this._expenses.set(fallback);
        }
      }
    );
  }

  add(expense: Omit<Expense, 'id'>): void {
    const newItem: Expense = { ...sanitizeStrings(expense), id: crypto.randomUUID() };
    const updated = [...this._expenses(), newItem];
    this._expenses.set(updated);
    this.save(updated);
  }

  remove(id: string): void {
    const updated = this._expenses().filter(e => e.id !== id);
    this._expenses.set(updated);
    this.save(updated);
  }

  update(id: string, changes: Partial<Omit<Expense, 'id'>>): void {
    const updated = this._expenses().map(e => e.id === id ? { ...e, ...sanitizeStrings(changes) } : e);
    this._expenses.set(updated);
    this.save(updated);
  }

  total(): number {
    return this._expenses().reduce((sum, e) => sum + e.amount, 0);
  }

  /** Download all personal expenses as a JSON backup file. */
  exportJson(): void {
    const user = this.userService.currentUser();
    const payload = {
      version: 1,
      user: user?.name ?? 'unknown',
      exportedAt: new Date().toISOString(),
      expenses: this._expenses(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = `expenses-${user?.name ?? 'backup'}-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Restore expenses from a JSON backup file.
   * Merges by ID: keeps existing entries, adds any from the file that aren't present.
   * Returns the number of new entries added.
   */
  importJson(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw  = JSON.parse(reader.result as string);
          const incoming: Expense[] = Array.isArray(raw) ? raw : (raw.expenses ?? []);
          const existing = this._expenses();
          const existingIds = new Set(existing.map(e => e.id));
          const newItems = incoming.filter(e => e.id && !existingIds.has(e.id));
          if (newItems.length > 0) {
            const merged = [...existing, ...newItems].sort((a, b) => a.date.localeCompare(b.date));
            this._expenses.set(merged);
            this.save(merged);
          }
          resolve(newItems.length);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private errorLogger = inject(ErrorLoggerService);

  private save(items: Expense[]): void {
    const user = this.userService.currentUser();
    if (!user) return;
    const backupKey = BACKUP_KEY_PREFIX + user.name;
    // Always write to localStorage immediately so new additions survive Firestore errors
    this.writeBackup(backupKey, items);
    this.errorLogger.trackWrite();
    setDoc(doc(this.firestore, 'userExpenses', user.name), { items })
      .catch(err => {
        console.error('[Expenses] Failed to save:', err);
        this.errorLogger.logError(err, 'firebase_error');
      });
  }

  private writeBackup(key: string, items: Expense[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch { /* storage full — skip */ }
  }
}
