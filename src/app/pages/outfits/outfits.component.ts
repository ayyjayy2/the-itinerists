import { Component, OnInit, inject, signal, computed, NgZone, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { WeatherService, LiveWeather, weatherEmoji } from '../../services/weather.service';
import { OutfitPhotoService } from '../../services/outfit-photo.service';
import { OutfitsService } from '../../services/outfits.service';
import { ItineraryService } from '../../services/itinerary.service';
import { FlightsService } from '../../services/flights.service';
import { TripService } from '../../services/trip.service';
import { PackingService } from '../../services/packing.service';
import { PackingSync } from '../../utils/packing-match';
import { outfitPhotoIds, MAX_OUTFIT_PHOTOS } from '../../utils/outfit-photos';
import { tripDestinations } from '../../utils/trip-destinations';
import { OutfitEntry } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';
import { NoTripStateComponent } from '../../shared/no-trip-state/no-trip-state.component';

/** Inclusive YYYY-MM-DD range builder. */
function dateRange(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + 'T00:00');
  const end_ = new Date(end + 'T00:00');
  while (cur <= end_) { days.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
  return days;
}

/** Fallback when a trip has no dates yet: today + the next 6 days, so outfits stay addable. */
function fallbackWindow(): string[] {
  const days: string[] = [];
  const cur = new Date(); cur.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) { days.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
  return days;
}

function suggestOutfit(minF: number, maxF: number, code: number, activities: string[]): string {
  const avg    = (minF + maxF) / 2;
  const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
  const actStr = activities.join(' ').toLowerCase();
  const isWalk   = /walk|square|park|tour|cemetery|river|stroll/.test(actStr);
  const isDining = /dinner|restaurant|dining|bistro|grey|lunch/.test(actStr);
  const isNight  = /ghost|bar|drink|pub|rooftop/.test(actStr);

  if (isRain && avg > 70) return 'Warm & rainy: light sundress or shorts + breezy top, a packable rain jacket, and waterproof sandals or sneakers.';
  if (isRain)             return 'Rain expected: light waterproof layer, jeans or leggings, comfortable sneakers.';
  if (avg >= 82)          return 'Hot & humid! Flowy sundress or shorts + breathable top, sandals, sun hat, and SPF. Stay hydrated!';
  if (avg >= 74) {
    if (isDining) return 'Warm dinner night: a cute sundress or linen pants + blouse, strappy sandals, light cardigan for A/C.';
    if (isNight)  return 'Warm night out: flowy dress or chic shorts + top, sandals, light layer for the bar A/C.';
    if (isWalk)   return 'Perfect walking weather! Sundress or shorts + tee, comfortable sneakers or sandals, light layer for indoor A/C.';
    return 'Beautiful weather! Light outfit — dress, shorts, or jeans + breezy top. Comfortable shoes for exploring.';
  }
  if (avg >= 65) {
    if (isWalk) return 'Lovely day to explore! Jeans or a midi skirt, a cute top, and comfortable walking shoes. Light jacket for the evening.';
    return 'Warm-ish and pleasant. Jeans + a nice top or light dress, comfortable shoes, and a light jacket just in case.';
  }
  return 'Cooler evening — layer up! Jeans, a cozy top, and a light jacket. Comfortable shoes for walking.';
}

interface DayData {
  date: string;
  liveWeather: LiveWeather | null;
  activities: string[];
  suggestion: string;
  isTravelDay: boolean;
}

@Component({
  selector: 'app-outfits',
  imports: [IconComponent, NoTripStateComponent, CommonModule, FormsModule, RouterLink],
  templateUrl: './outfits.component.html',
  styleUrl: './outfits.component.scss'
})
export class OutfitsComponent implements OnInit {
  userService    = inject(UserService);
  weatherService = inject(WeatherService);
  photoService   = inject(OutfitPhotoService);
  outfitsService = inject(OutfitsService);
  itineraryService = inject(ItineraryService);
  flightsService   = inject(FlightsService);
  tripService      = inject(TripService);
  packingService   = inject(PackingService);
  private ngZone = inject(NgZone);

  currentUser = this.userService.currentUser;
  uploading   = this.photoService.uploading;
  isAdmin     = this.userService.isAdmin;

  /** Active-trip date state (TP-23). */
  readonly hasActiveTrip = computed(() => this.tripService.activeTrip() !== null);
  readonly hasTripDates  = computed(() => {
    const t = this.tripService.activeTrip();
    return !!(t?.startDate && t?.endDate);
  });

  view             = signal<'day' | 'all'>('day');
  currentDateIndex = signal(0);
  editingDate      = signal<string | null>(null);

  /** Resolved data URLs for my own photos, keyed by photo id. */
  photoCache = signal<Record<string, string>>({});
  readonly maxPhotos = MAX_OUTFIT_PHOTOS;

  /** What the last outfit save put on (or kept off) the packing list; shown briefly. */
  packingNotice = signal<PackingSync | null>(null);
  private packingNoticeTimer?: ReturnType<typeof setTimeout>;

  editForm: { items: string[]; newItem: string; notes: string; photoIds: string[] } =
    { items: [], newItem: '', notes: '', photoIds: [] };

  /** Autosave state: every change writes through; this flashes "Saved" afterwards. */
  saveState = signal<'idle' | 'saving' | 'saved'>('idle');
  private savedTimer?: ReturnType<typeof setTimeout>;
  private notesTimer?: ReturnType<typeof setTimeout>;

  weatherEmoji = weatherEmoji;

  constructor() {
    // Load weather for every destination leg so each day shows its city.
    effect(() => {
      const t = this.tripService.activeTrip();
      if (t) this.weatherService.loadMany(tripDestinations(t));
    });

    // Eagerly resolve the current user's own stored outfit photos from Firestore.
    // Photos are owner-private, so we only ever fetch our own (and the template
    // only renders our own).
    effect(() => {
      const me     = this.currentUser();
      const tripId = this.tripService.activeTrip()?.id;
      if (!me?.uid || !tripId) return;
      for (const o of this.outfitsService.outfits().filter(o => o.user === me.name)) {
        for (const id of outfitPhotoIds(o, o.date, me.uid!)) {
          if (this.photoCache()[id]) continue;
          this.photoService.getPhoto(tripId, id).then(url => {
            if (url) this.ngZone.run(() => this.photoCache.update(c => ({ ...c, [id]: url })));
          });
        }
      }
    });
  }

  readonly tripDays = computed((): string[] => {
    const t = this.tripService.activeTrip();
    if (t?.startDate && t?.endDate) return dateRange(t.startDate, t.endDate);
    // A trip with no dates yet still gets addable day cards (TP-23); no trip → empty.
    return t ? fallbackWindow() : [];
  });

  effectiveDayLabel(date: string): string {
    const custom = this.itineraryService.dayLabels()[date];
    if (custom) return custom;
    const start = this.tripService.activeTrip()?.startDate;
    if (!start) return date;
    const diff = Math.round(
      (new Date(date + 'T00:00').getTime() - new Date(start + 'T00:00').getTime()) / 86_400_000
    );
    return `Day ${diff + 1}`;
  }

  readonly myOutfitsByDate = computed((): Record<string, OutfitEntry> => {
    const user = this.currentUser();
    if (!user) return {};
    const map: Record<string, OutfitEntry> = {};
    for (const o of this.outfitsService.outfits()) {
      if (o.user === user.name) map[o.date] = o;
    }
    return map;
  });

  readonly days = computed((): DayData[] => {
    const uid     = this.currentUser()?.uid ?? '';
    const name    = this.currentUser()?.name ?? '';
    const weather = this.weatherService.weather();
    const flights = this.flightsService.flights();

    const flightDates = new Set(
      flights
        .filter(f => f.uid === uid)
        .flatMap(f => [f.departureDate, f.arrivalDate].filter(Boolean))
    );

    const staticSuggestion = 'Pack light layers, breathable fabrics, and comfortable walking shoes. Live weather will show up within 16 days of the trip.';
    const travelSuggestion = 'Travel day! Comfy leggings or joggers, an oversized tee or soft knit, slip-on shoes, and a warm wrap for the cabin.';

    return this.tripDays().map((date): DayData => {
      const allItems  = this.itineraryService.items().filter(i => i.date === date);
      const userItems = allItems.filter(i =>
        i.forWho === 'All' || i.forWho.split(',').map(s => s.trim()).includes(name)
      );
      const hasFlight = flightDates.has(date);

      const isTransport = (a: { category: string; activity: string }) =>
        a.category === 'Transport' || /\b(flight|airport|depart|arrive|travel)\b/i.test(a.activity);

      const isTravelDay = hasFlight && (userItems.length === 0 || userItems.every(isTransport));
      if (isTravelDay) {
        return { date, liveWeather: null, activities: userItems.map(i => i.activity), suggestion: travelSuggestion, isTravelDay: true };
      }

      const liveWeather = weather[date] ?? null;
      const actNames    = userItems.map(i => i.activity);
      const suggestion  = liveWeather
        ? suggestOutfit(liveWeather.minF, liveWeather.maxF, liveWeather.code, actNames)
        : staticSuggestion;

      return { date, liveWeather, activities: actNames, suggestion, isTravelDay: false };
    });
  });

  readonly currentDay = computed(() => this.days()[this.currentDateIndex()] ?? null);

  ngOnInit(): void {
    const today = new Date().toISOString().slice(0, 10);
    const idx   = this.days().findIndex(d => d.date >= today);
    this.currentDateIndex.set(idx >= 0 ? idx : 0);
  }

  prevDay(): void { this.currentDateIndex.update(i => Math.max(0, i - 1)); }
  nextDay(): void { this.currentDateIndex.update(i => Math.min(this.days().length - 1, i + 1)); }

  goToDay(index: number): void {
    this.currentDateIndex.set(index);
    this.view.set('day');
  }

  startEdit(date: string): void {
    const myOutfit = this.myOutfitsByDate()[date] ?? null;
    const user     = this.currentUser();
    const photoIds = myOutfit && user?.uid ? outfitPhotoIds(myOutfit, date, user.uid) : [];
    this.editForm = {
      items:    [...(myOutfit?.items ?? [])],
      newItem:  '',
      notes:    myOutfit?.notes ?? '',
      photoIds: [...photoIds],
    };
    this.saveState.set('idle');
    this.editingDate.set(date);
  }

  /** Close the editor. Everything is already saved; just flush a half-typed item or pending notes. */
  closeEdit(date: string): void {
    if (this.editForm.newItem.trim()) this.addItem(date);
    if (this.notesTimer) { clearTimeout(this.notesTimer); this.notesTimer = undefined; this.persist(date); }
    this.editingDate.set(null);
  }

  /** Add the typed item, save the day, and put the item on the packing list. */
  addItem(date: string): void {
    const v = this.editForm.newItem.trim();
    if (!v) return;
    this.editForm.items.push(v);
    this.editForm.newItem = '';
    this.persist(date);
    // Outfit items are things to pack: add this one unless it's already listed.
    this.showPackingNotice(this.packingService.addFromOutfit([v], []));
  }

  removeItem(i: number, date: string): void {
    this.editForm.items.splice(i, 1);
    this.persist(date);
  }

  /** Notes save shortly after typing stops. */
  onNotesChange(date: string): void {
    clearTimeout(this.notesTimer);
    this.notesTimer = setTimeout(() => { this.notesTimer = undefined; this.persist(date); }, 600);
  }

  /** Write the edit form to the day's outfit. Called after every change. */
  private async persist(date: string): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    this.saveState.set('saving');
    const photoIds = [...this.editForm.photoIds];
    try {
      await this.outfitsService.upsertOutfit({
        date,
        user:     user.name,
        items:    [...this.editForm.items],
        notes:    this.editForm.notes.trim() || undefined,
        photoIds,
        photoUrl: photoIds.length ? 'stored' : undefined,
      });
      this.ngZone.run(() => {
        this.saveState.set('saved');
        clearTimeout(this.savedTimer);
        this.savedTimer = setTimeout(() => this.saveState.set('idle'), 2000);
      });
    } catch (err) {
      console.error('[outfits] autosave failed:', err);
      this.ngZone.run(() => this.saveState.set('idle'));
    }
  }

  /** Photo ids to show for a day's outfit (my own, honoring the legacy single photo). */
  photoIdsFor(date: string): string[] {
    const outfit = this.myOutfitsByDate()[date];
    const uid = this.currentUser()?.uid;
    return outfit && uid ? outfitPhotoIds(outfit, date, uid) : [];
  }

  /** Upload one or more photos for a day, up to the cap, appending to the outfit's gallery. */
  async uploadPhotos(event: Event, date: string): Promise<void> {
    const user   = this.currentUser();
    const tripId = this.tripService.activeTrip()?.id;
    const input  = event.target as HTMLInputElement;
    const files  = Array.from(input.files ?? []);
    input.value  = '';
    if (!user?.uid || !tripId || !files.length) return;

    const editing = this.editingDate() === date;
    const current = editing ? this.editForm.photoIds : this.photoIdsFor(date);
    const room    = Math.max(0, MAX_OUTFIT_PHOTOS - current.length);
    const added: string[] = [];
    try {
      for (const file of files.slice(0, room)) {
        const { id, dataUrl } = await this.photoService.upload(tripId, date, user.uid, file);
        added.push(id);
        this.ngZone.run(() => this.photoCache.update(c => ({ ...c, [id]: dataUrl })));
      }
    } catch (err) {
      if ((err as Error)?.message !== 'cancelled') console.error('[uploadPhotos] failed:', err);
    }
    if (!added.length) return;
    this.ngZone.run(() => {
      if (editing) {
        this.editForm.photoIds = [...this.editForm.photoIds, ...added];
        this.persist(date);
      } else {
        this.outfitsService.patchOutfitPhotos(date, user.name, [...current, ...added]);
      }
    });
  }

  /** Drop a photo: the day saves without it and its doc is deleted. */
  removeEditPhoto(id: string, date: string): void {
    this.editForm.photoIds = this.editForm.photoIds.filter(p => p !== id);
    this.persist(date);
    const tripId = this.tripService.activeTrip()?.id;
    if (tripId) this.photoService.deletePhoto(tripId, id);
  }

  cancelUpload(): void { this.photoService.cancelUpload(); }

  async deleteOutfit(date: string): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    if (!confirm('Delete your outfit plan for this day?')) return;
    this.editingDate.set(null);
    await this.outfitsService.deleteOutfit(date, user.name);
  }

  private showPackingNotice(sync: PackingSync): void {
    clearTimeout(this.packingNoticeTimer);
    if (!sync.added.length && !sync.skipped.length) { this.packingNotice.set(null); return; }
    this.packingNotice.set(sync);
    this.packingNoticeTimer = setTimeout(() => this.packingNotice.set(null), 8000);
  }

  dismissPackingNotice(): void { clearTimeout(this.packingNoticeTimer); this.packingNotice.set(null); }

  formatDate(d: string): string {
    return new Date(d + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}
