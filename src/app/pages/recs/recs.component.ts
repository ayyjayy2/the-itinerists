import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecsService } from '../../services/recs.service';
import { UserService } from '../../services/user.service';
import { Rec, RecDoc } from '../../models/trip.models';

const CATEGORIES = ['Food', 'Drink', 'Places', 'Activities', 'Tips', 'Culture'];

const SEED_RECS: Rec[] = [
  // ── Food ──────────────────────────────────────────────────────────────────
  {
    category: 'Food',
    title: 'The Grey',
    description: 'Upscale Southern cuisine inside a beautifully restored 1938 Greyhound bus terminal. One of the best restaurants in the South.',
    extra: 'Reservations strongly recommended — book well in advance.',
  },
  {
    category: 'Food',
    title: "Mrs. Wilkes' Dining Room",
    description: 'Famous family-style Southern cooking — fried chicken, collard greens, cornbread, and more shared at communal tables.',
    extra: 'Cash only. Expect a line outside — it moves fast and is worth every minute.',
  },
  {
    category: 'Food',
    title: 'Savannah Candy Kitchen',
    description: 'Iconic Savannah shop famous for fresh Georgia peach pralines made right in front of you.',
    extra: 'Multiple locations downtown. The pralines are the move.',
  },
  {
    category: 'Food',
    title: "Huey's on the River",
    description: 'New Orleans-style breakfast and brunch on River Street with great waterfront views.',
    extra: "The beignets are excellent. Perfect spot for a lazy morning.",
  },

  // ── Drink ─────────────────────────────────────────────────────────────────
  {
    category: 'Drink',
    title: 'Ghost Coast Distillery',
    description: "Savannah's first distillery, known for their gin. Great cocktails and tours of the distillery available.",
    extra: 'Tours run most days — check their schedule. The cocktail menu is creative.',
  },
  {
    category: 'Drink',
    title: 'Rocks on the Roof',
    description: 'Rooftop bar at The Bohemian Hotel with stunning views of the Savannah River.',
    extra: 'Best at sunset. Can get busy on weekends — grab a spot early.',
  },
  {
    category: 'Drink',
    title: 'Prohibition',
    description: 'Speakeasy-style cocktail bar on Bay Street with a vintage Prohibition-era vibe and excellent craft drinks.',
    extra: 'The old-fashioned and aviation cocktails are standouts.',
  },
  {
    category: 'Drink',
    title: 'Congress Street Social Club',
    description: 'Laid-back, unpretentious bar popular with locals. Good beer selection and a great neighborhood feel.',
    extra: 'A nice break from the more touristy spots on River Street.',
  },

  // ── Places ────────────────────────────────────────────────────────────────
  {
    category: 'Places',
    title: 'Forsyth Park',
    description: 'The crown jewel of Savannah — a beautiful 30-acre park anchored by the famous white cast-iron fountain.',
    extra: 'Perfect for a morning walk. Farmers market on Saturdays.',
  },
  {
    category: 'Places',
    title: 'Bonaventure Cemetery',
    description: 'A hauntingly beautiful Victorian cemetery draped in Spanish moss, made famous by "Midnight in the Garden of Good and Evil."',
    extra: 'Free to visit. Best explored in the late afternoon when the light filters through the oaks.',
  },
  {
    category: 'Places',
    title: 'River Street',
    description: 'Historic cobblestone waterfront strip lined with shops, restaurants, bars, and great views of the river.',
    extra: 'Watch for the massive container ships passing through — it\'s surprisingly close.',
  },
  {
    category: 'Places',
    title: 'The Historic Squares',
    description: 'Savannah has 22 park-like squares spread throughout the historic district, each with its own character and history.',
    extra: 'Chippewa, Madison, and Lafayette squares are fan favorites. Pick up a map and wander.',
  },

  // ── Activities ────────────────────────────────────────────────────────────
  {
    category: 'Activities',
    title: 'Ghost Tour',
    description: 'Savannah is widely considered one of the most haunted cities in America. Evening ghost tours are atmospheric and genuinely fun.',
    extra: 'Several companies offer tours — walking and trolley formats available.',
  },
  {
    category: 'Activities',
    title: 'Old Town Trolley Tour',
    description: 'Hop-on, hop-off narrated trolley tour covering all major landmarks. Great for getting oriented on day one.',
    extra: 'Tickets are good all day. Start early to make the most of it.',
  },
  {
    category: 'Activities',
    title: 'Walk the Squares',
    description: "One of the best ways to experience Savannah is simply to walk — the grid of squares makes it easy and endlessly interesting.",
    extra: 'Pick a square, find a bench, people-watch. No agenda needed.',
  },

  // ── Tips ──────────────────────────────────────────────────────────────────
  {
    category: 'Tips',
    title: 'Open Container Law',
    description: 'Savannah allows alcoholic drinks in plastic cups on public streets in the downtown historic district.',
    extra: 'Must be in a plastic cup — no glass. Most bars will pour your drink into one to go. 🎉',
  },
  {
    category: 'Tips',
    title: 'Parking',
    description: 'Street parking can be tricky. City garages off Congress Street and Bryan Street are your best bets.',
    extra: 'The parking garage at State Street and Abercorn is convenient for the historic district.',
  },
  {
    category: 'Tips',
    title: 'Weather in April',
    description: 'Savannah in April is warm and can be humid. Expect highs in the 70s–80s°F.',
    extra: 'Light breathable layers, sunscreen, and comfortable walking shoes are a must.',
  },
  {
    category: 'Tips',
    title: 'Use the Squares as Landmarks',
    description: 'Navigating by square name is very Savannah. "Meet me at Chippewa Square" is cleaner than any address.',
    extra: 'Download the Savannah squares map before you go — it\'s a game changer.',
  },

  // ── Culture ───────────────────────────────────────────────────────────────
  {
    category: 'Culture',
    title: 'Midnight in the Garden of Good and Evil',
    description: 'The 1994 bestselling book (and 1997 Clint Eastwood film) set in Savannah is basically required reading before the trip.',
    extra: 'The Mercer Williams House on Monterey Square is a key landmark from the book.',
  },
  {
    category: 'Culture',
    title: 'SCAD — Savannah College of Art and Design',
    description: 'SCAD has a massive presence throughout downtown Savannah, with galleries, cafes, and renovated historic buildings all over.',
    extra: 'The SCAD Museum of Art on Martin Luther King Jr. Blvd is free and worth a visit.',
  },
  {
    category: 'Culture',
    title: 'Southern Hospitality',
    description: "Savannah locals are genuinely warm and friendly. Don't be surprised if strangers strike up a full conversation.",
    extra: 'Slow down, say hello, and lean into it — it\'s one of the best parts of the trip.',
  },
];

@Component({
  selector: 'app-recs',
  imports: [CommonModule, FormsModule],
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

  // Seed + user-added combined
  readonly allRecs = computed((): Array<Rec & { id?: string; isUserAdded: boolean }> => {
    const seed = SEED_RECS.map(r => ({ ...r, isUserAdded: false }));
    const user = this.recsService.recs().map(r => ({ ...r, isUserAdded: true }));
    return [...seed, ...user];
  });

  readonly filtered = computed(() => {
    const cat = this.selectedCategory();
    return cat === 'All' ? this.allRecs() : this.allRecs().filter(r => r.category === cat);
  });

  readonly groupedByCat = computed((): [string, Array<Rec & { id?: string; isUserAdded: boolean }>][] => {
    const order = [...CATEGORIES];
    const groups: Record<string, Array<Rec & { id?: string; isUserAdded: boolean }>> = {};
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

  canDelete(rec: Rec & { id?: string; isUserAdded: boolean }): boolean {
    if (!rec.isUserAdded || !rec.id) return false;
    const uid = this.currentUser()?.uid;
    if (this.isAdmin()) return true;
    const full = this.recsService.recs().find(r => r.id === rec.id);
    return full?.addedByUid === uid;
  }

  async deleteRec(id: string): Promise<void> {
    await this.recsService.deleteRec(id);
  }

  setCategory(cat: string): void { this.selectedCategory.set(cat); }
}
