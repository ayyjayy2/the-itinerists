import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { DataService } from '../../services/data.service';
import { ExpensesService } from '../../services/expenses.service';
import { PackingService } from '../../services/packing.service';
import { FlightCountdownService } from '../../services/flight-countdown.service';
import { TripUser } from '../../models/trip.models';
import { APP_VERSION, APP_BUILD_DATE } from '../../../version';

// Fallback users if Firestore isn't available yet
const FALLBACK_USERS: TripUser[] = [
  { name: 'Alayna',    color: '#F4C2C2', avatarEmoji: '🌸' },
  { name: 'Makaela',  color: '#88C9A1', avatarEmoji: '🍀', isBirthday: true },
  { name: 'Dad',      color: '#D4B5F5', avatarEmoji: '🐘' },
  { name: 'Linda',    color: '#F9E4B7', avatarEmoji: '🌼' },
  { name: 'Madeleine',color: '#F5B5D4', avatarEmoji: '🦋' },
  { name: 'Caitlin',  color: '#B5D5F5', avatarEmoji: '✨' },
];

@Component({
  selector: 'app-user-select',
  imports: [CommonModule],
  templateUrl: './user-select.component.html',
  styleUrl: './user-select.component.scss'
})
export class UserSelectComponent implements OnInit, OnDestroy {
  private userService       = inject(UserService);
  private dataService       = inject(DataService);
  private expensesService   = inject(ExpensesService);
  private packingService    = inject(PackingService);
  private flightCountdown   = inject(FlightCountdownService);
  private router            = inject(Router);

  readonly version   = APP_VERSION;
  readonly buildDate = APP_BUILD_DATE;
  users         = signal<TripUser[]>([]);
  loading       = signal(true);
  hintUserName  = signal<string | null>(null);
  countdowns    = signal<Record<string, string>>({});

  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.hintUserName.set(this.userService.getLastUserHint());
    this.dataService.init();

    setTimeout(() => {
      const data = this.dataService.data();
      if (data?.users?.length) {
        this.users.set(data.users.filter(u => u.name !== 'Arielle'));
      } else {
        this.users.set(FALLBACK_USERS);
      }
      this.loading.set(false);
      this.updateCountdowns();
    }, 1500);

    // Refresh countdowns every minute
    this.countdownTimer = setInterval(() => this.updateCountdowns(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  private updateCountdowns(): void {
    const flights = this.dataService.data()?.flights ?? [];
    const map: Record<string, string> = {};
    for (const user of this.users()) {
      map[user.name] = this.flightCountdown.getCountdown(user.name, flights);
    }
    this.countdowns.set(map);
  }

  selectUser(user: TripUser): void {
    this.userService.setUser(user);
    this.expensesService.init();
    this.packingService.init();
    this.router.navigate(['/home']);
  }

  isHinted(user: TripUser): boolean {
    return user.name === this.hintUserName();
  }
}
