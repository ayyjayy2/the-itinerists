import { Component, OnInit, inject, signal, computed, NgZone, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { UserService } from '../../services/user.service';
import { WeatherService, LiveWeather, weatherEmoji } from '../../services/weather.service';
import { OutfitPhotoService } from '../../services/outfit-photo.service';
import { OutfitEntry, ItineraryItem } from '../../models/trip.models';

const TRIP_DATES = [
  '2026-03-13','2026-03-14','2026-03-15','2026-03-16',
  '2026-03-17','2026-03-18','2026-03-19','2026-03-20',
  '2026-03-21','2026-03-22',
];

/** Map an activity location string to the nearest weather city. Returns null for non-Irish locations. */
function detectCity(location: string): string | null {
  const loc = location.toLowerCase();
  if (/belfast|causeway|antrim|banbridge|voco/.test(loc)) return 'Belfast';
  if (/galway/.test(loc)) return 'Galway';
  if (/killarney|kerry|waterville|horseshoe/.test(loc)) return 'Killarney';
  if (/cork|stationview/.test(loc)) return 'Cork';
  if (/wicklow|waterford|cliffs|moher|clare/.test(loc)) return 'Dublin';
  if (/dublin|arthaus|heuston|skylon/.test(loc)) return 'Dublin';
  return null;
}

/** Returns the primary Irish city for a set of activities (uses the last recognizable city). */
function primaryCityForDate(activities: { location: string }[]): string | null {
  let city: string | null = null;
  for (const a of activities) {
    const c = detectCity(a.location);
    if (c) city = c;
  }
  return city;
}

function suggestOutfit(
  minF: number, maxF: number, code: number,
  activities: string[], date: string, isMale: boolean
): string {
  const avg = (minF + maxF) / 2;
  const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
  const actStr = activities.join(' ').toLowerCase();
  const isOutdoor = /causeway|cliff|hike|tour|giant|walk|wicklow|castle|moher/.test(actStr);
  const isPub    = /pub|bar|guinness|brew/.test(actStr);
  const isDining = /dinner|restaurant|dining|bistro/.test(actStr);

  if (date === '2026-03-17') {
    return isMale
      ? '🍀 St. Paddy\'s: Green shirt or knit, dark jeans, warmest jacket — massive crowds all day!'
      : '🍀 St. Paddy\'s: Go all green! Emerald dress or shamrock jumper, warm tights, ankle boots, cozy coat for the parade crowd!';
  }

  if (isMale) {
    if (avg < 40) return '🥶 Very cold: thermal undershirt, thick fleece, waterproof jacket, warm jeans, waterproof boots, beanie & gloves.';
    if (isRain)   return '🌧️ Rain expected: waterproof jacket essential, jeans, waterproof boots, beanie.';
    if (avg < 50) return '☁️ Chilly: chunky knit or fleece, dark jeans, boots or trainers, light jacket.';
    return '🌤️ Mild-ish: jeans, casual shirt or light jumper, comfortable shoes.';
  }

  if (avg < 40) return '🥶 Very cold: thermal base layer, chunky knit, puffer or wool coat, fleece-lined leggings, waterproof knee boots, chunky scarf, beanie & gloves.';
  if (isOutdoor && isRain) return '🥾🌧️ Outdoor + rain: waterproof shell jacket essential! Long sleeve + waterproof hiking pants or thick leggings, waterproof boots, gloves & beanie.';
  if (isOutdoor && avg < 52) return '🥾 Outdoor adventure: layers! Thermal long sleeve + fleece + waterproof jacket, thick leggings or hiking pants, waterproof ankle boots, beanie.';
  if (isRain && avg < 52) return '🌧️ Cold & rainy: trench coat or waterproof jacket over a chunky knit, dark jeans, ankle rain boots, cute scarf.';
  if (isRain)   return '🌦️ Rain likely: stylish rain jacket or trench, jeans, waterproof ankle boots, scarf.';
  if (avg < 45) return '🧥 Cold: chunky knit sweater, thick tights + midi skirt OR warm jeans, knee-high boots, wool coat, scarf & beanie.';
  if (avg < 52) return '☁️ Chilly: cute knit sweater, dark jeans or leggings, ankle boots, long cardigan, scarf.';
  if (isDining) return '✨ Dinner night: statement dress or silk blouse + tailored trousers, heeled boots or pointed flats, elegant jacket.';
  if (isPub)    return '🍺 Pub night: cute jeans or mini skirt, cozy knit or statement top, ankle boots, light jacket.';
  return '🌤️ Mild for Ireland! Jeans or cute midi skirt, lightweight jumper, trainers or ankle boots, light jacket just in case.';
}

interface DayData {
  date: string;
  dayLabel: string;
  liveWeather: LiveWeather | null;
  staticWeather: string;
  activities: ItineraryItem[];
  suggestion: string;
  isTravelDay: boolean;
}

@Component({
  selector: 'app-outfits',
  imports: [CommonModule, FormsModule],
  templateUrl: './outfits.component.html',
  styleUrl: './outfits.component.scss'
})
export class OutfitsComponent implements OnInit {
  dataService    = inject(DataService);
  userService    = inject(UserService);
  weatherService = inject(WeatherService);
  photoService   = inject(OutfitPhotoService);
  private ngZone = inject(NgZone);

  currentUser = this.userService.currentUser;
  uploading   = this.photoService.uploading;

  view             = signal<'day' | 'all'>('day');
  currentDateIndex = signal(0);
  editingDate      = signal<string | null>(null);

  /** Resolved data URLs for outfits stored in Firestore (photoUrl === 'stored'). */
  photoCache = signal<Record<string, string>>({});
  /** Data URL shown in the edit form photo preview. */
  editPhotoDataUrl = '';

  editForm: {
    items: string[];
    newItem: string;
    notes: string;
    photoUrl: string;
  } = { items: [], newItem: '', notes: '', photoUrl: '' };

  constructor() {
    // Eagerly load any outfit photos stored in Firestore whenever outfits change.
    effect(() => {
      const stored = this.dataService.outfits().filter(o => o.photoUrl === 'stored');
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

  /** Reactive map of date → OutfitEntry for the current user.
   *  Reads directly from the outfits signal so the template updates immediately after save. */
  myOutfitsByDate = computed((): Record<string, OutfitEntry> => {
    const user = this.currentUser();
    if (!user) return {};
    const map: Record<string, OutfitEntry> = {};
    for (const o of this.dataService.outfits()) {
      if (o.user === user.name) map[o.date] = o;
    }
    return map;
  });

  weatherEmoji = weatherEmoji;

  days = computed((): DayData[] => {
    const data = this.dataService.data();
    const weather = this.weatherService.weather();
    const user = this.currentUser();
    if (!data) return [];

    const isFlightAct = (a: ItineraryItem) =>
      a.category === 'Transport' ||
      /\b(flight|airport|depart|arrive|travel|transit)\b/i.test(a.activity + ' ' + a.location);

    // Build the set of dates on which the user has a flight leg (departure or arrival).
    const userFlightDates = new Set(
      data.flights
        .filter(f => !user || this.matchesFlightPerson(f.person, user.name))
        .flatMap(f => [f.departureDate, f.arrivalDate].filter(Boolean))
    );

    return TRIP_DATES.flatMap((date): DayData[] => {
      const allItems  = data.itinerary.filter(i => i.date === date);
      const dayLabel  = allItems[0]?.dayLabel ?? date;
      const userItems = allItems.filter(i =>
        i.forWho === 'All' || !user || i.forWho.split(',').map(s => s.trim()).includes(user.name)
      );

      const hasFlight = userFlightDates.has(date);

      // Skip dates where the user has no itinerary items and no flights.
      if (userItems.length === 0 && !hasFlight) return [];

      const isMale = user?.name === 'Dad';

      const travelSuggestion = isMale
        ? '✈️ Travel day! Comfortable joggers or relaxed jeans, soft tee, zip hoodie, slip-on trainers — easy layers for a long flight!'
        : '✈️ Travel day! Soft leggings or wide-leg trousers, cozy oversized knit, slip-on shoes for security — and a warm wrap for the cabin!';

      // No itinerary items but a flight on this date → pure travel day.
      if (userItems.length === 0) {
        return [{ date, dayLabel, liveWeather: null, staticWeather: '', activities: [], suggestion: travelSuggestion, isTravelDay: true }];
      }

      // All itinerary items are transport/travel → travel day.
      if (userItems.every(isFlightAct)) {
        return [{ date, dayLabel, liveWeather: null, staticWeather: '', activities: userItems, suggestion: travelSuggestion, isTravelDay: true }];
      }

      const city = primaryCityForDate(userItems);

      if (!city) {
        // No Irish city — treat as travel day if any flight activity exists, otherwise generic.
        if (userItems.some(isFlightAct) || hasFlight) {
          return [{ date, dayLabel, liveWeather: null, staticWeather: '', activities: userItems, suggestion: travelSuggestion, isTravelDay: true }];
        }
        const fallback = isMale
          ? '🍀 Layers are key! Jeans, a warm knit, and a waterproof jacket will cover most of what Ireland throws at you.'
          : '🍀 Layers are key! Jeans or leggings, a cozy knit, ankle boots, and a waterproof jacket will cover most of what Ireland throws at you.';
        return [{ date, dayLabel, liveWeather: null, staticWeather: data.weatherByDate?.[date] ?? '', activities: userItems, suggestion: fallback, isTravelDay: false }];
      }

      // Normal Irish-city day.
      const liveWeather   = weather[`${date}_${city}`] ?? null;
      const staticWeather = data.weatherByDate?.[date] ?? '';
      const actNames      = userItems.map(i => i.activity);
      const suggestion    = liveWeather
        ? suggestOutfit(liveWeather.minF, liveWeather.maxF, liveWeather.code, actNames, date, isMale)
        : (isMale
          ? '☁️ Ireland weather varies — layers are your best friend! Jeans, a warm knit, waterproof jacket, and comfy shoes.'
          : '☁️ Ireland weather varies — layers are your best friend! Jeans or leggings, a cozy knit, waterproof jacket, and ankle boots.');

      return [{ date, dayLabel, liveWeather, staticWeather, activities: userItems, suggestion, isTravelDay: false }];
    });
  });

  /** Fuzzy-match flight person field against a user name (handles "Maddie/Caitlin/Linda" etc.). */
  private matchesFlightPerson(person: string, name: string): boolean {
    const p = person.toLowerCase();
    const n = name.toLowerCase();
    if (p.includes(n)) return true;
    const tokens = p.split(/[\/,&\s]+/).filter(Boolean);
    if (n.length >= 3) {
      const prefix = n.substring(0, 3);
      return tokens.some(t => t.startsWith(prefix));
    }
    return false;
  }

  currentDay = computed(() => this.days()[this.currentDateIndex()] ?? null);

  ngOnInit(): void {
    this.weatherService.load();
    // Jump to today or first upcoming date in the user's filtered day list
    const today = new Date().toISOString().slice(0, 10);
    const idx = this.days().findIndex(d => d.date >= today);
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
    const user = this.currentUser();
    this.editForm = {
      items:    [...(myOutfit?.items ?? [])],
      newItem:  '',
      notes:    myOutfit?.notes ?? '',
      photoUrl: myOutfit?.photoUrl ?? '',
    };
    // Populate edit preview from cache for Firestore-stored photos
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

    // Fire-and-forget — save can happen at any time while this runs.
    // Run the callback inside NgZone so signal updates trigger change detection.
    this.photoService.upload(file, date, user.name).then(url => {
      this.ngZone.run(() => {
        const key = `${date}_${user.name}`;
        this.photoCache.update(c => ({ ...c, [key]: url }));
        if (this.editingDate() === date) {
          this.editPhotoDataUrl = url;
          this.editForm.photoUrl = 'stored';
        } else {
          this.dataService.patchOutfitPhoto(date, user.name, 'stored');
        }
      });
    }).catch(err => console.error('[uploadPhoto] failed:', err));
  }

  cancelUpload(): void {
    this.photoService.cancelUpload();
  }

  deleteOutfit(date: string): void {
    const user = this.currentUser();
    if (!user) return;
    if (!confirm('Delete your outfit plan for this day?')) return;
    this.editingDate.set(null);
    this.dataService.deleteOutfit(date, user.name);
  }

  saveOutfit(date: string): void {
    const user = this.currentUser();
    if (!user) return;
    // Auto-add any text still in the newItem input (user forgot to tap Add).
    if (this.editForm.newItem.trim()) {
      this.editForm.items.push(this.editForm.newItem.trim());
      this.editForm.newItem = '';
    }
    // Close the form first so the UI responds immediately.
    this.editingDate.set(null);
    this.dataService.upsertOutfit({
      date,
      user: user.name,
      items:    [...this.editForm.items],
      notes:    this.editForm.notes.trim() || undefined,
      photoUrl: this.editForm.photoUrl || undefined,
    });
  }

  formatDate(d: string): string {
    return new Date(d + 'T00:00').toLocaleDateString('en-IE', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}
