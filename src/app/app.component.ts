import { Component, OnInit, inject, computed, effect } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { UserService } from './services/user.service';
import { AuthService } from './services/auth.service';
import { DataService } from './services/data.service';
import { TripService } from './services/trip.service';
import { UsersService } from './services/users.service';
import { ExpensesService } from './services/expenses.service';
import { PackingService } from './services/packing.service';
import { FlightsService } from './services/flights.service';
import { ItineraryService } from './services/itinerary.service';
import { StaysService } from './services/stays.service';
import { FinanceService } from './services/finance.service';
import { RecsService } from './services/recs.service';
import { OutfitsService } from './services/outfits.service';
import { APP_VERSION, APP_BUILD_DATE } from '../version';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  userService   = inject(UserService);
  authService   = inject(AuthService);
  dataService   = inject(DataService);
  tripService   = inject(TripService);   // constructed early so it restores the active trip on login (TP-14)
  usersService  = inject(UsersService);
  expensesService   = inject(ExpensesService);
  packingService    = inject(PackingService);
  flightsService    = inject(FlightsService);
  itineraryService  = inject(ItineraryService);
  staysService      = inject(StaysService);
  financeService    = inject(FinanceService);
  recsService       = inject(RecsService);
  outfitsService    = inject(OutfitsService);
  router        = inject(Router);
  private swUpdate = inject(SwUpdate);

  readonly version   = APP_VERSION;
  readonly buildDate = APP_BUILD_DATE;
  sidebarOpen  = false;
  navCollapsed = localStorage.getItem('tripplanner_nav_collapsed') === 'true';

  readonly baseNavItems: NavItem[] = [
    { path: '/home',           label: 'Home',            icon: '🏠' },
    { path: '/trips',          label: 'My Trips',        icon: '🧭' },
    { path: '/flights',        label: 'Flights',         icon: '✈️' },
    { path: '/itinerary',      label: 'Itinerary',       icon: '📅' },
    { path: '/accommodations', label: 'Stays',           icon: '🏨' },
    { path: '/finance',        label: 'Finance',         icon: '💵' },
    { path: '/expenses',       label: 'My Expenses',     icon: '🧾' },
    { path: '/recs',           label: 'Recs',            icon: '🌸' },
    { path: '/packing',        label: 'Packing',         icon: '🧳' },
    { path: '/outfits',        label: 'Outfits',         icon: '👗' },
    { path: '/trip-settings',  label: 'Trip Settings',   icon: '⚙️' },
    { path: '/profile',        label: 'Profile',         icon: '👤' },
  ];

  readonly navItems = computed<NavItem[]>(() => {
    // Hide pages this member toggled off for the active trip (TP-15).
    const hidden = this.tripService.hiddenPages();
    const items = this.baseNavItems.filter(i => !hidden.includes(i.path.slice(1)));
    if (this.userService.isAdmin()) {
      items.push({ path: '/admin', label: 'Admin', icon: '⚙️' });
    }
    return items;
  });

  currentUser = this.userService.currentUser;

  constructor() {
    // When a user logs in, start all data listeners
    effect(() => {
      if (this.userService.currentUser()) {
        this.dataService.init();
        this.usersService.init();
        this.expensesService.init();
        this.packingService.init();
        this.flightsService.init();
        this.itineraryService.init();
        this.staysService.init();
        this.financeService.init();
        this.recsService.init();
        this.outfitsService.init();
      }
    });
  }

  ngOnInit(): void {
    // Auto-apply new service worker versions so deploys take effect on next reload
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      ).subscribe(() => {
        this.swUpdate.activateUpdate().then(() => window.location.reload());
      });
    }
  }

  isAuthPage(): boolean {
    return this.router.url.startsWith('/login') || this.router.url.startsWith('/join');
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    this.sidebarOpen = false;
    this.router.navigate(['/login']);
  }

  hardRefresh(): void {
    const reload = () => window.location.reload();
    const clearAndReload = () => {
      if ('caches' in window) {
        caches.keys()
          .then(keys => Promise.all(keys.map(k => caches.delete(k))))
          .then(reload);
      } else {
        reload();
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => Promise.all(regs.map(r => r.unregister())))
        .then(clearAndReload);
    } else {
      clearAndReload();
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleCollapse(): void {
    this.navCollapsed = !this.navCollapsed;
    localStorage.setItem('tripplanner_nav_collapsed', String(this.navCollapsed));
  }
}
