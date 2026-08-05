import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PackingService } from '../../services/packing.service';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { TripService } from '../../services/trip.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { NoTripStateComponent } from '../../shared/no-trip-state/no-trip-state.component';

type TabType = 'list' | 'suggestions' | 'send';

@Component({
  selector: 'app-packing-list',
  imports: [IconComponent, NoTripStateComponent, CommonModule, FormsModule],
  templateUrl: './packing-list.component.html',
  styleUrl: './packing-list.component.scss'
})
export class PackingListComponent implements OnInit {
  packingService = inject(PackingService);
  userService    = inject(UserService);
  usersService   = inject(UsersService);
  tripService = inject(TripService);
  readonly hasActiveTrip = computed(() => this.tripService.activeTrip() !== null);

  currentUser = this.userService.currentUser;
  tab = signal<TabType>('list');

  // My items
  newItem         = signal('');
  newItemCategory = signal('Clothes');
  items           = this.packingService.items;
  categories      = this.packingService.categories;

  // Category filter
  selectedCategory = signal<string>('All');
  addingCategory   = signal<boolean>(false);
  newCategoryName  = signal<string>('');

  filteredItems = computed(() => {
    const cat = this.selectedCategory();
    return cat === 'All'
      ? this.items()
      : this.items().filter(i => (i.category ?? 'Clothes') === cat);
  });

  packedCount   = computed(() => this.items().filter(i => i.packed).length);
  unpackedCount = computed(() => this.items().filter(i => !i.packed).length);

  filteredPackedCount   = computed(() => this.filteredItems().filter(i => i.packed).length);
  filteredUnpackedCount = computed(() => this.filteredItems().filter(i => !i.packed).length);

  // Inbox (suggestions for me)
  inbox = computed(() => this.packingService.inboxSuggestions());

  // Send suggestion
  sendToUser = signal('');
  sendItem   = signal('');
  sending    = signal(false);

  otherUsers = computed(() => {
    const me = this.currentUser()?.name ?? '';
    return this.usersService.tripUsers().filter(u => u.name !== me);
  });

  ngOnInit(): void {
    this.packingService.init();
  }

  setCategory(cat: string): void {
    this.selectedCategory.set(cat);
    if (cat !== 'All') this.newItemCategory.set(cat);
  }

  addCategory(): void {
    const name = this.newCategoryName().trim();
    if (!name) return;
    this.packingService.addCategory(name);
    this.selectedCategory.set(name);
    this.newItemCategory.set(name);
    this.newCategoryName.set('');
    this.addingCategory.set(false);
  }

  cancelAddCategory(): void {
    this.newCategoryName.set('');
    this.addingCategory.set(false);
  }

  addItem(): void {
    const label = this.newItem().trim();
    if (!label) return;
    this.packingService.addItem(label, this.newItemCategory());
    this.newItem.set('');
  }

  toggle(id: string): void {
    this.packingService.toggleItem(id);
  }

  remove(id: string): void {
    this.packingService.removeItem(id);
  }

  accept(id: string): void {
    this.packingService.acceptSuggestion(id);
  }

  decline(id: string): void {
    this.packingService.declineSuggestion(id);
  }

  sendSuggestion(): void {
    const to   = this.sendToUser();
    const item = this.sendItem().trim();
    if (!to || !item) return;
    this.packingService.sendSuggestion(to, item);
    this.sendItem.set('');
  }

  setTab(t: TabType): void { this.tab.set(t); }

  formatTime(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
