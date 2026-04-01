import { Injectable, signal, inject, NgZone, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, collection, onSnapshot, getDocs, setDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { SheetData, FinanceEntry, ItineraryItem, Rec, RentalCar, OutfitEntry, MapPin } from '../models/trip.models';
import { SEED_DATA } from '../data/seed-data';
import { sanitizeStrings } from '../utils/sanitize';
import { ErrorLoggerService } from './error-logger.service';

const TRIP_DOC        = 'app/tripData';
const PAID_DOC        = 'app/paidItems';
const TRIP_BACKUP_KEY = 'ireland_tripdata_backup';
const PAID_BACKUP_KEY = 'ireland_paiditems_backup';

// Items known to be settled outside the app — written to Firestore on first run
const DEFAULT_PAID_ITEMS: string[] = [
  "Dad__Alayna__2025-12-27__(1) king, (1) twin, 3 nights",
  "Arielle__Alayna__2025-12-27__(1) king, (1) twin, 3 nights",
  "Stinky__Alayna__2025-12-27__(1) king, (1) twin, 3 nights",
];

/** Rename old paid-item keys when descriptions change. */
function migratePaidKeys(items: string[]): string[] {
  return items.map(k =>
    // Alayna's Arthaus booking description rename
    k.replace("__Arthaus Hotel Dublin — Alayna's booking", "__(1) king, (1) twin, 3 nights")
     // Makaela's Arthaus booking: old description rename
     .replace("__Arthaus Hotel Dublin — Makaela's booking", "__(2) twin bedrooms, 3 nights")
  );
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private firestore    = inject(Firestore);
  private ngZone       = inject(NgZone);
  private injector     = inject(Injector);
  private errorLogger  = inject(ErrorLoggerService);

  private _data    = signal<SheetData | null>(null);
  private _loading = signal(true);
  private _outfits = signal<OutfitEntry[]>([]);

  readonly data    = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly outfits = this._outfits.asReadonly();
  readonly isStale = signal(false); // kept for template compatibility

  /** Shared paid settlement item keys — synced across all users in real time */
  paidItems = signal<Set<string>>(new Set());

  // Flags for one-time outfit migration coordination
  private _tripDataLoaded = false;
  private _outfitsLoaded  = false;

  /** Start real-time Firestore listeners. Call once from AppComponent.ngOnInit. */
  init(): void {
    runInInjectionContext(this.injector, () => this._init());
  }

  private _init(): void {
    // ── Trip data listener ──────────────────────────────────────────────────────
    onSnapshot(
      doc(this.firestore, TRIP_DOC),
      snap => {
        if (snap.exists()) {
          const data = snap.data() as SheetData;
          const migrated = this.migrate(data);
          if (migrated !== data) {
            setDoc(doc(this.firestore, TRIP_DOC), migrated)
              .catch(err => console.error('[DataService] Failed to write migration:', err));
          }
          this._data.set(migrated);
          this.writeBackup(TRIP_BACKUP_KEY, migrated);
        } else {
          // First run: seed Firestore with the hardcoded seed data
          setDoc(doc(this.firestore, TRIP_DOC), { ...SEED_DATA })
            .catch(err => console.error('[DataService] Failed to seed trip data:', err));
          this._data.set({ ...SEED_DATA });
          this.writeBackup(TRIP_BACKUP_KEY, { ...SEED_DATA });
        }
        this._loading.set(false);
        if (!this._tripDataLoaded) {
          this._tripDataLoaded = true;
          this.tryMigrateOutfits();
        }
      },
      err => {
        // Offline / permission error: fall back to local backup, then seed data
        console.error('[DataService] Trip data snapshot error:', err);
        if (!this._data()) {
          const backup = this.readBackup<SheetData>(TRIP_BACKUP_KEY);
          this._data.set(backup ?? { ...SEED_DATA });
        }
        this._loading.set(false);
      }
    );

    // ── Outfits: load once on init, then mutations keep _outfits in sync ──────────
    getDocs(collection(this.firestore, 'outfits')).then(snap => {
      this.ngZone.run(() => {
        this._outfits.set(snap.docs.map(d => d.data() as OutfitEntry));
        this._outfitsLoaded = true;
        this.tryMigrateOutfits();
      });
    }).catch(() => {
      this.ngZone.run(() => {
        this._outfitsLoaded = true;
        this.tryMigrateOutfits();
      });
    });

    // ── Paid settlements listener ───────────────────────────────────────────────
    onSnapshot(
      doc(this.firestore, PAID_DOC),
      snap => {
        if (snap.exists()) {
          const raw      = snap.data()['items'] as string[];
          const migrated = migratePaidKeys(raw);
          if (migrated.some((k, i) => k !== raw[i])) {
            setDoc(doc(this.firestore, PAID_DOC), { items: migrated })
              .catch(err => console.error('[DataService] Failed to migrate paid keys:', err));
          }
          this.paidItems.set(new Set(migrated));
          this.writeBackup(PAID_BACKUP_KEY, migrated);
        } else {
          // First run: seed with known-settled items
          setDoc(doc(this.firestore, PAID_DOC), { items: DEFAULT_PAID_ITEMS })
            .catch(err => console.error('[DataService] Failed to seed paid items:', err));
          this.paidItems.set(new Set(DEFAULT_PAID_ITEMS));
          this.writeBackup(PAID_BACKUP_KEY, DEFAULT_PAID_ITEMS);
        }
      },
      err => {
        console.error('[DataService] Paid items snapshot error:', err);
        const backup = this.readBackup<string[]>(PAID_BACKUP_KEY);
        if (backup) this.paidItems.set(new Set(backup));
      }
    );
  }

  /** Toggle a settlement item as paid/unpaid — shared across all users. */
  togglePaidItem(key: string): void {
    const next = new Set(this.paidItems());
    next.has(key) ? next.delete(key) : next.add(key);
    this.paidItems.set(next);
    const items = [...next];
    this.writeBackup(PAID_BACKUP_KEY, items);
    setDoc(doc(this.firestore, PAID_DOC), { items })
      .catch(err => console.error('[DataService] Failed to toggle paid item:', err));
  }

  /** No-op — Firestore listener handles live updates automatically. */
  refresh(): void {}

  // ── Itinerary mutations ───────────────────────────────────────────────────────

  patchItineraryItem(date: string, origActivity: string, updates: Partial<ItineraryItem>): void {
    const current = this._data();
    if (!current) return;
    const itinerary = current.itinerary.map(item =>
      item.date === date && item.activity === origActivity ? { ...item, ...sanitizeStrings(updates) } : item
    );
    this.save({ ...current, itinerary });
  }

  addItineraryItem(item: ItineraryItem): void {
    const current = this._data();
    if (!current) return;
    item = sanitizeStrings(item);
    const items = [...current.itinerary];

    const dateStart = items.findIndex(it => it.date === item.date);
    if (dateStart === -1) {
      const pos = items.findIndex(it => it.date > item.date);
      items.splice(pos === -1 ? items.length : pos, 0, item);
    } else {
      const newMins = this.parseTimeToMinutes(item.time);
      let insertAt = items.length;
      for (let i = dateStart; i < items.length; i++) {
        if (items[i].date !== item.date) { insertAt = i; break; }
        if (newMins < this.parseTimeToMinutes(items[i].time)) { insertAt = i; break; }
      }
      items.splice(insertAt, 0, item);
    }

    this.save({ ...current, itinerary: items });
  }

  moveItineraryItem(date: string, fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    const current = this._data();
    if (!current) return;
    const items    = [...current.itinerary];
    const dayItems = items.filter(it => it.date === date);
    if (fromIndex >= dayItems.length || toIndex >= dayItems.length) return;
    const [moved] = dayItems.splice(fromIndex, 1);
    dayItems.splice(toIndex, 0, moved);
    let di = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].date === date) items[i] = dayItems[di++];
    }
    this.save({ ...current, itinerary: items });
  }

  sortItineraryDay(date: string): void {
    const current = this._data();
    if (!current) return;
    const items    = [...current.itinerary];
    const dayItems = items
      .filter(i => i.date === date)
      .sort((a, b) => this.parseTimeToMinutes(a.time) - this.parseTimeToMinutes(b.time));
    let di = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].date === date) items[i] = dayItems[di++];
    }
    this.save({ ...current, itinerary: items });
  }

  deleteItineraryItem(date: string, activity: string): void {
    const current = this._data();
    if (!current) return;
    const itinerary = current.itinerary.filter(
      item => !(item.date === date && item.activity === activity)
    );
    this.save({ ...current, itinerary });
  }

  // ── Finance mutations ─────────────────────────────────────────────────────────

  patchFinanceEntry(date: string, description: string, updates: Partial<FinanceEntry>): void {
    const current = this._data();
    if (!current) return;
    const finance = current.finance.map(e =>
      e.date === date && e.description === description ? { ...e, ...sanitizeStrings(updates) } : e
    );
    this.save({ ...current, finance });
  }

  addRec(rec: Rec): void {
    const current = this._data();
    if (!current) return;
    this.save({ ...current, recs: [...current.recs, sanitizeStrings(rec)] });
  }

  deleteRentalCar(index: number): void {
    const current = this._data();
    if (!current) return;
    const rentalCar = current.rentalCar.filter((_, i) => i !== index);
    this.save({ ...current, rentalCar });
  }

  addRentalCar(car: RentalCar): void {
    const current = this._data();
    if (!current) return;
    this.save({ ...current, rentalCar: [...current.rentalCar, sanitizeStrings(car)] });
  }

  patchRentalCar(index: number, updates: Partial<RentalCar>): void {
    const current = this._data();
    if (!current) return;
    const rentalCar = current.rentalCar.map((c, i) => i === index ? { ...c, ...sanitizeStrings(updates) } : c);
    this.save({ ...current, rentalCar });
  }

  deleteFinanceEntry(date: string, description: string): void {
    const current = this._data();
    if (!current) return;
    const finance = current.finance.filter(e => !(e.date === date && e.description === description));
    this.save({ ...current, finance });
  }

  // ── Map pin mutations ─────────────────────────────────────────────────────────

  addMapPin(pin: MapPin): void {
    const current = this._data();
    if (!current) return;
    this.save({ ...current, mapPins: [...(current.mapPins ?? []), sanitizeStrings(pin)] });
  }

  removeMapPin(id: string): void {
    const current = this._data();
    if (!current) return;
    this.save({ ...current, mapPins: (current.mapPins ?? []).filter(p => p.id !== id) });
  }

  addFinanceEntry(entry: FinanceEntry): void {
    const current = this._data();
    if (!current) return;
    const finance = [...current.finance, sanitizeStrings(entry)].sort((a, b) => a.date.localeCompare(b.date));
    this.save({ ...current, finance });
  }

  patchOutfitPhoto(date: string, user: string, photoUrl: string): void {
    const id = `${user}_${date}`;
    updateDoc(doc(this.firestore, 'outfits', id), { photoUrl }).catch(() => {});
    this._outfits.update(list =>
      list.map(o => o.date === date && o.user === user ? { ...o, photoUrl } : o)
    );
  }

  deleteOutfit(date: string, user: string): void {
    deleteDoc(doc(this.firestore, 'outfits', `${user}_${date}`));
    this._outfits.update(list => list.filter(o => !(o.date === date && o.user === user)));
  }

  upsertOutfit(entry: OutfitEntry): void {
    entry = sanitizeStrings(entry);
    // Firestore throws synchronously on undefined values — strip them before writing.
    const docData = Object.fromEntries(
      Object.entries(entry).filter(([, v]) => v !== undefined)
    );
    setDoc(doc(this.firestore, 'outfits', `${entry.user}_${entry.date}`), docData);
    this._outfits.update(list => {
      const idx = list.findIndex(o => o.date === entry.date && o.user === entry.user);
      return idx >= 0 ? list.map((o, i) => i === idx ? entry : o) : [...list, entry];
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  /**
   * One-time migration: if the outfits collection is empty but the legacy tripData.outfits
   * array has entries, copy each outfit to its own document so no data is lost.
   * Runs once after both listeners have fired their first snapshot.
   */
  private tryMigrateOutfits(): void {
    if (!this._tripDataLoaded || !this._outfitsLoaded) return;
    const legacy = this._data()?.outfits ?? [];
    if (this._outfits().length === 0 && legacy.length > 0) {
      for (const outfit of legacy) {
        setDoc(doc(this.firestore, 'outfits', `${outfit.user}_${outfit.date}`), outfit);
      }
      this._outfits.set(legacy);
    }
  }

  /** Write the full trip data document to Firestore and update the local signal. */
  private save(data: SheetData): void {
    this._data.set(data);
    this.writeBackup(TRIP_BACKUP_KEY, data);
    this.errorLogger.trackWrite();
    setDoc(doc(this.firestore, TRIP_DOC), data)
      .catch(err => {
        console.error('[DataService] Failed to save trip data:', err);
        this.errorLogger.logError(err, 'firebase_error');
      });
  }

  private writeBackup<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* storage full — skip */ }
  }

  private readBackup<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : null;
    } catch {
      return null;
    }
  }

  /** One-time migrations applied to live Firestore data. */
  private migrate(data: SheetData): SheetData {
    let changed = false;

    // Remove Graham and Arielle from users; update Caitlin's color to blue
    const users = data.users
      .filter(u => u.name !== 'Graham' && u.name !== 'Arielle')
      .map(u => u.name === 'Caitlin' && u.color === '#FFD9A8' ? { ...u, color: '#B5D5F5' } : u);
    if (users.length !== data.users.length) changed = true;

    // Rename Graham → Stinky in finance splitAmong (Arielle stays in finance)
    // Also fix paidBy, splitAmong, and descriptions for known incorrect entries.
    // IMPORTANT: each condition must match ONLY the old/pre-migration data shape so it
    // won't re-fire after user edits (description renames serve as one-time migration flags).
    let finance = data.finance.map(e => {
      let updated = { ...e };

      // Graham → Stinky in splitAmong
      if (updated.splitAmong.includes('Graham')) {
        changed = true;
        updated = { ...updated, splitAmong: updated.splitAmong.replace(/\bGraham\b/g, 'Stinky') };
      }

      // Fix Arthaus Makaela's booking: old description is the trigger (one-time)
      if (updated.vendor === 'Arthaus Hotel Dublin' && updated.paidBy === 'Linda' &&
          updated.description.includes("Makaela's booking")) {
        changed = true;
        updated = { ...updated,
          paidBy: 'Makaela',
          description: '(2) twin bedrooms, 3 nights',
          splitAmong: 'Makaela, Madeleine, Caitlin, Linda',
          notes: '$367.04/pp × 4; bank charge: Jingleberry LMTD',
        };
      }

      // Fix Arthaus Alayna's booking: old description is the trigger (one-time)
      if (updated.vendor === 'Arthaus Hotel Dublin' && updated.paidBy === 'Alayna' &&
          updated.description.includes("Alayna's booking")) {
        changed = true;
        updated = { ...updated, description: '(1) king, (1) twin, 3 nights' };
      }

      // Fix Guinness: old description is the trigger (one-time)
      if (updated.vendor === 'Guinness Storehouse' &&
          updated.description === 'Guinness Storehouse tickets') {
        changed = true;
        updated = { ...updated, description: 'Brewery Tour & Pouring Certification' };
      }

      // Fix voco Belfast: old description 'voco Belfast' (not renamed yet) is the trigger
      if (updated.vendor === 'voco Belfast' && updated.description === 'voco Belfast') {
        changed = true;
        updated = { ...updated, description: 'voco Belfast — full group', splitAmong: 'Madeleine, Linda, Caitlin' };
      }

      // Fix Victoria Hotel Galway (Madeleine's): old description is the trigger
      if (updated.vendor === 'Victoria Hotel Galway' && updated.paidBy === 'Madeleine' &&
          updated.description === 'Victoria Hotel Galway') {
        changed = true;
        updated = { ...updated, description: 'Victoria Hotel Galway — full group', splitAmong: 'Madeleine, Linda, Caitlin' };
      }

      // Fix AirBnb Night 1: merge into single entry (old description is the trigger).
      // Guard against matching the new split entries ("Horseshoe Cottage — Night 1/2").
      if (updated.vendor === 'AirBnb' && updated.description.includes('Night 1') && !updated.description.startsWith('Horseshoe')) {
        changed = true;
        updated = { ...updated,
          description: 'Horseshoe Cottage, Killarney',
          amount: 529.92,
          splitAmong: 'Linda, Alayna, Caitlin, Madeleine',
          notes: '$132.48/pp × 4',
        };
      }

      return updated;
    // Remove the stale AirBnb Night 2 entry (old data only — guard against new split entries).
    }).filter(e => !(e.vendor === 'AirBnb' && e.description.includes('Night 2') && !e.description.startsWith('Horseshoe')));

    // V1: Add missing finance entries (one-time, guarded by migrationVersion)
    if (!data.migrationVersion || data.migrationVersion < 1) {
      const newEntries: FinanceEntry[] = [
        { date: '2026-01-03', description: 'Cliffs of Moher Tour', amount: 358.45, currency: 'USD',
          paidBy: 'Caitlin', splitAmong: 'Caitlin, Makaela, Madeleine, Dad',
          category: 'Activity', vendor: 'Viator', notes: '$89.61/pp × 4', link: '' },
        { date: '2026-03-13', description: 'Belfast Hotel — Makaela & Dad', amount: 223.42, currency: 'USD',
          paidBy: 'Makaela', splitAmong: 'Makaela, Dad',
          category: 'Lodging', vendor: 'Voco Hotel Belfast', notes: '$111.71/pp × 2', link: '' },
        { date: '2026-03-13', description: 'Game of Thrones Tour & High Tea', amount: 297.12, currency: 'USD',
          paidBy: 'Makaela', splitAmong: 'Makaela, Dad, Caitlin, Madeleine',
          category: 'Activity', vendor: 'Game of Thrones Tour', notes: '$74.28/pp × 4', link: '' },
        { date: '2026-03-14', description: "Victoria Hotel Galway — Makaela's booking", amount: 733.80, currency: 'USD',
          paidBy: 'Makaela', splitAmong: 'Makaela, Dad, Arielle, Stinky',
          category: 'Lodging', vendor: 'Victoria Hotel Galway', notes: '$183.45/pp × 4', link: '' },
        { date: '2026-03-19', description: 'Iceland Hotel — 2 nights', amount: 541.24, currency: 'USD',
          paidBy: 'Makaela', splitAmong: 'Makaela, Dad, Arielle, Stinky',
          category: 'Lodging', vendor: 'Konvin Hotel', notes: '$135.31/pp × 4', link: '' },
        { date: '2026-03-20', description: 'Whale Watching Tour', amount: 436.12, currency: 'USD',
          paidBy: 'Makaela', splitAmong: 'Makaela, Dad, Arielle, Stinky',
          category: 'Activity', vendor: 'GetYourGuide', notes: '$109.03/pp × 4', link: '' },
      ];
      for (const entry of newEntries) {
        if (!finance.some(e => e.description === entry.description && e.paidBy === entry.paidBy)) {
          finance.push(entry);
        }
      }
      changed = true;
    }

    // V2: Fix splitAmong values that were incorrect in v1 (one-time, guarded by migrationVersion)
    if (!data.migrationVersion || data.migrationVersion < 2) {
      finance = finance.map(e => {
        // voco Belfast and Victoria Galway (Madeleine's): remove everyone except Madeleine/Linda/Caitlin
        if ((e.description === 'voco Belfast — full group' ||
             e.description === 'Victoria Hotel Galway — full group') &&
            e.splitAmong !== 'Madeleine, Linda, Caitlin') {
          changed = true;
          return { ...e, splitAmong: 'Madeleine, Linda, Caitlin' };
        }
        // Iceland/Whale/Victoria Makaela's: AJ was Arielle, not Alayna
        if (['Iceland Hotel — 2 nights', 'Whale Watching Tour',
             "Victoria Hotel Galway — Makaela's booking"].includes(e.description) &&
            e.splitAmong.includes('Alayna')) {
          changed = true;
          return { ...e, splitAmong: e.splitAmong.replace('Alayna', 'Arielle') };
        }
        return e;
      });
    }

    // V4: Split Horseshoe Cottage into two separate nightly entries
    if (!data.migrationVersion || data.migrationVersion < 4) {
      const cottageIdx = finance.findIndex(e =>
        e.vendor === 'AirBnb' && e.description === 'Horseshoe Cottage, Killarney'
      );
      if (cottageIdx >= 0) {
        changed = true;
        const night1: FinanceEntry = {
          date: '2026-02-18',
          description: 'Horseshoe Cottage — Night 1',
          amount: 264.96,
          currency: 'USD',
          paidBy: 'Linda',
          splitAmong: 'Linda, Alayna, Caitlin, Madeleine',
          category: 'Lodging',
          vendor: 'AirBnb',
          notes: '$66.24/pp × 4',
          link: '',
        };
        const night2: FinanceEntry = {
          date: '2026-02-18',
          description: 'Horseshoe Cottage — Night 2',
          amount: 198.72,
          currency: 'USD',
          paidBy: 'Linda',
          splitAmong: 'Linda, Caitlin, Madeleine',
          category: 'Lodging',
          vendor: 'AirBnb',
          notes: '$66.24/pp × 3',
          link: '',
        };
        finance.splice(cottageIdx, 1, night1, night2);
      }
    }

    // V5: Fix finance entry errors found via spreadsheet cross-check
    if (!data.migrationVersion || data.migrationVersion < 5) {
      finance = finance.map(e => {
        // GOT Tour: missing Linda, wrong amount
        if (e.description === 'Game of Thrones Tour & High Tea' && e.paidBy === 'Makaela' &&
            Math.abs(e.amount - 297.12) < 1) {
          changed = true;
          return { ...e, amount: 371.39, splitAmong: 'Makaela, Dad, Caitlin, Madeleine, Linda', notes: '$74.28/pp × 5' };
        }
        // Belfast Hotel: Dad owes full cost, Makaela has no share
        if (e.description === 'Belfast Hotel — Makaela & Dad' && e.paidBy === 'Makaela' &&
            Math.abs(e.amount - 223.42) < 1) {
          changed = true;
          return { ...e, amount: 224.01, splitAmong: 'Dad', notes: 'Full hotel cost for Dad' };
        }
        // Cliffs of Moher: Dad was wrong, should be Linda; amount was wrong
        if (e.description === 'Cliffs of Moher Tour' && e.paidBy === 'Caitlin' &&
            Math.abs(e.amount - 358.45) < 1) {
          changed = true;
          return { ...e, amount: 279.24, splitAmong: 'Caitlin, Makaela, Madeleine, Linda', notes: '$69.81/pp × 4' };
        }
        // Horseshoe Cottage Night 2: amount was wrong (should match Night 1)
        if (e.description === 'Horseshoe Cottage — Night 2' && e.paidBy === 'Linda' &&
            Math.abs(e.amount - 198.72) < 1) {
          changed = true;
          return { ...e, amount: 264.96, notes: '$88.32/pp × 3' };
        }
        // Whale Watching was actually Blue Lagoon — wrong name, amount, and split
        if (e.description === 'Whale Watching Tour' && e.paidBy === 'Makaela' &&
            Math.abs(e.amount - 436.12) < 1) {
          changed = true;
          return { ...e, description: 'Blue Lagoon', vendor: 'Blue Lagoon', amount: 299.80,
                   splitAmong: 'Makaela, Dad', notes: '$149.90/pp × 2' };
        }
        return e;
      })
      // Victoria Hotel Galway (Makaela's booking) is not in the trip spreadsheet — remove it
      .filter(e => !(e.description === "Victoria Hotel Galway — Makaela's booking" && e.paidBy === 'Makaela'));

      // Add missing Exit row seat for Dad
      if (!finance.some(e => e.description === 'Exit row seat — Dad' && e.paidBy === 'Makaela')) {
        changed = true;
        finance.push({
          date: '2026-03-13', description: 'Exit row seat — Dad', amount: 85.00, currency: 'USD',
          paidBy: 'Makaela', splitAmong: 'Dad', category: 'Transport',
          vendor: 'Airline', notes: '$85.00 for Dad only', link: '',
        });
      }
    }

    // V6: Remove duplicate entries and fix remaining split errors
    if (!data.migrationVersion || data.migrationVersion < 6) {
      // Remove 3 duplicate Dad→Makaela entries (old "hotel" entry, blank Blue Lagoon copy,
      // and "Exit row seat" which duplicates "Exit row seat — Dad" added in V5)
      finance = finance.filter(e => {
        if (e.description === 'hotel' && e.paidBy === 'Makaela' &&
            e.date === '2026-03-10' && e.splitAmong === 'Dad') {
          changed = true; return false;
        }
        if (!e.description && e.paidBy === 'Makaela' && e.date === '2026-03-20' &&
            Math.abs(e.amount - 299.80) < 1) {
          changed = true; return false;
        }
        if (e.description === 'Exit row seat' && e.paidBy === 'Makaela' &&
            e.date === '2026-03-19' && e.splitAmong === 'Dad') {
          changed = true; return false;
        }
        return true;
      });

      // Cliffs of Moher: V5 intended to replace Dad with Linda but the amount condition
      // didn't match (amount was already correct in Firestore). Fix the split now.
      finance = finance.map(e => {
        if (e.description === 'Cliffs of Moher Tour' && e.paidBy === 'Caitlin' &&
            e.splitAmong?.includes('Dad')) {
          changed = true;
          return { ...e, splitAmong: 'Caitlin, Makaela, Madeleine, Linda', notes: '$69.81/pp × 4' };
        }
        // Mar 26 parking/tolls: Alayna had already left on Mar 21 — remove her from split
        if (!e.description && e.paidBy === 'Madeleine' && e.date === '2026-03-26' &&
            e.splitAmong?.includes('Alayna')) {
          changed = true;
          return { ...e, splitAmong: 'Linda, Madeleine, Caitlin' };
        }
        return e;
      });
    }

    // V3: Add mock rental car entry for layout preview
    if (!data.migrationVersion || data.migrationVersion < 3) {
      const mock: RentalCar = {
        company: 'Enterprise',
        confirmationNumber: 'ENT-20482',
        rentalName: 'Alayna',
        passengers: 'Alayna, Dad, Caitlin, Madeleine',
        location: 'Dublin & Galway',
        platform: 'Enterprise.com',
        pickupDate: '2026-03-13',
        pickupTime: '10:00',
        pickupLocation: 'Dublin Airport T1',
        dropoffDate: '2026-03-17',
        dropoffTime: '09:00',
        dropoffLocation: 'Dublin Airport T1',
        drivers: 'Alayna',
        notes: 'Full coverage insurance included. Manual transmission — confirm before pickup.',
        link: 'https://www.enterprise.com',
      };
      if (!data.rentalCar?.some(c => c.confirmationNumber === mock.confirmationNumber)) {
        changed = true;
        (data as any).rentalCar = [...(data.rentalCar ?? []), mock];
      }
    }

    finance.sort((a, b) => a.date.localeCompare(b.date));

    // Remove Graham and Arielle from itinerary forWho
    const itinerary = data.itinerary.map(item => {
      if (!item.forWho.includes('Graham') && !item.forWho.includes('Arielle')) return item;
      changed = true;
      const forWho = item.forWho
        .split(',').map(s => s.trim()).filter(s => s !== 'Graham' && s !== 'Arielle').join(', ');
      return { ...item, forWho };
    });

    // Remove Graham from flights person; remove Arielle-only flight records
    const flights = data.flights
      .map(f => {
        if (!f.person.includes('Graham')) return f;
        changed = true;
        const person = f.person
          .replace(/Graham\s*&\s*/g, '').replace(/\s*&\s*Graham/g, '').trim();
        return { ...f, person };
      })
      .filter(f => {
        if (f.person.trim() === 'Arielle') { changed = true; return false; }
        return true;
      });

    // Remove Graham and Arielle from accommodations forWho
    const accommodations = data.accommodations.map(a => {
      if (!a.forWho.includes('Graham') && !a.forWho.includes('Arielle')) return a;
      changed = true;
      const forWho = a.forWho
        .split(',').map(s => s.trim()).filter(s => s !== 'Graham' && s !== 'Arielle').join(', ');
      return { ...a, forWho };
    });

    return changed ? { ...data, users, finance, itinerary, flights, accommodations, migrationVersion: 6 } : data;
  }

  private parseTimeToMinutes(time: string): number {
    if (!time) return 9999;
    const t = time.replace(/\s+(CT|ET|PT|MT|IST)$/i, '').trim();
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return 9999;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
}
