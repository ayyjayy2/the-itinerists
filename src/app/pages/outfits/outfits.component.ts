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
import { OutfitEntry } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';

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
  imports: [IconComponent, CommonModule, FormsModule, RouterLink],
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

  photoCache       = signal<Record<string, string>>({});
  editPhotoDataUrl = '';

  editForm: { items: string[]; newItem: string; notes: string; photoUrl: string } =
    { items: [], newItem: '', notes: '', photoUrl: '' };

  weatherEmoji = weatherEmoji;

  constructor() {
    // Load weather once the active trip's dates are available
    effect(() => {
      const t = this.tripService.activeTrip();
      if (t?.startDate && t?.endDate) {
        this.weatherService.load(t.startDate, t.endDate, t.destination);
      }
    });

    // Eagerly resolve stored outfit photos from Firestore
    effect(() => {
      const stored = this.outfitsService.outfits().filter(o => o.photoUrl === 'stored');
      for (const o of stored) {
        const key = `${o.date}_${o.user}`;
        if (!this.photoCache()[key]) {
          this.photoService.getPhoto(o.date, o.user).then(url => {
            if (url) this.ngZone.run(() =>
              this.photoCache.update(c => ({ ...c, [key]: url }))
            );
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
    this.editForm = {
      items:    [...(myOutfit?.items ?? [])],
      newItem:  '',
      notes:    myOutfit?.notes ?? '',
      photoUrl: myOutfit?.photoUrl ?? '',
    };
    if (myOutfit?.photoUrl === 'stored' && user) {
      this.editPhotoDataUrl = this.photoCache()[`${date}_${user.name}`] ?? '';
    } else {
      this.editPhotoDataUrl = myOutfit?.photoUrl ?? '';
    }
    this.editingDate.set(date);
  }

  cancelEdit(): void { this.editingDate.set(null); }

  addItem(): void {
    const v = this.editForm.newItem.trim();
    if (v) { this.editForm.items.push(v); this.editForm.newItem = ''; }
  }

  removeItem(i: number): void { this.editForm.items.splice(i, 1); }

  uploadPhoto(event: Event, date: string): void {
    const user = this.currentUser();
    if (!user) return;
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.photoService.upload(file, date, user.name).then(url => {
      this.ngZone.run(() => {
        const key = `${date}_${user.name}`;
        this.photoCache.update(c => ({ ...c, [key]: url }));
        if (this.editingDate() === date) {
          this.editPhotoDataUrl = url;
          this.editForm.photoUrl = 'stored';
        } else {
          this.outfitsService.patchOutfitPhoto(date, user.name, 'stored');
        }
      });
    }).catch(err => console.error('[uploadPhoto] failed:', err));
  }

  cancelUpload(): void { this.photoService.cancelUpload(); }

  async deleteOutfit(date: string): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    if (!confirm('Delete your outfit plan for this day?')) return;
    this.editingDate.set(null);
    await this.outfitsService.deleteOutfit(date, user.name);
  }

  async saveOutfit(date: string): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    if (this.editForm.newItem.trim()) {
      this.editForm.items.push(this.editForm.newItem.trim());
      this.editForm.newItem = '';
    }
    this.editingDate.set(null);
    await this.outfitsService.upsertOutfit({
      date,
      user:     user.name,
      items:    [...this.editForm.items],
      notes:    this.editForm.notes.trim() || undefined,
      photoUrl: this.editForm.photoUrl || undefined,
    });
  }

  formatDate(d: string): string {
    return new Date(d + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}
