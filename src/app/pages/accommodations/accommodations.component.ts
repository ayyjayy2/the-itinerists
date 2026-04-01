import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-accommodations',
  imports: [CommonModule],
  templateUrl: './accommodations.component.html',
  styleUrl: './accommodations.component.scss'
})
export class AccommodationsComponent {
  dataService = inject(DataService);
  userService = inject(UserService);

  currentUser = this.userService.currentUser;

  /** true = show all stays, false = show only stays that include the current user */
  showAll = signal<boolean>(false);

  allAccommodations = computed(() => this.dataService.data()?.accommodations ?? []);

  displayedAccommodations = computed(() => {
    const all = this.allAccommodations();
    if (this.showAll()) return all;
    const me = this.currentUser()?.name ?? '';
    return all.filter(a =>
      a.forWho === 'All' || a.forWho.split(',').map(s => s.trim()).includes(me)
    );
  });

  isForMe(forWho: string): boolean {
    const me = this.currentUser()?.name ?? '';
    return forWho === 'All' || forWho.split(',').map(s => s.trim()).includes(me);
  }

  formatDate(d: string): string {
    if (!d) return '';
    const dt = new Date(d + 'T00:00');
    return dt.toLocaleDateString('en-IE', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  nightsBetween(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 0;
    const a = new Date(checkIn + 'T00:00');
    const b = new Date(checkOut + 'T00:00');
    return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  }

  refresh(): void { this.dataService.refresh(); }
}
