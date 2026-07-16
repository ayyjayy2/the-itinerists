import { Component, OnInit, inject, computed, effect, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IconComponent } from './shared/icon/icon.component';
import { BrandComponent } from './shared/brand/brand.component';
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
import { ThemeService } from './services/theme.service';
import { APP_VERSION, APP_BUILD_DATE } from '../version';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, IconComponent, BrandComponent],
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
  themeService  = inject(ThemeService);   // constructed early so the theme applies on load (DP2-4)
  router        = inject(Router);
  private swUpdate = inject(SwUpdate);

  readonly version   = APP_VERSION;
  readonly buildDate = APP_BUILD_DATE;
  sidebarOpen  = false;
  navCollapsed = localStorage.getItem('tripplanner_nav_collapsed') === 'true';

  // `icon` is now a name resolved by <app-icon> (custom line-icon set), not an emoji.
  readonly baseNavItems: NavItem[] = [
    { path: '/home',           label: 'Home',            icon: 'home' },
    { path: '/trips',          label: 'My Trips',        icon: 'trips' },
    { path: '/flights',        label: 'Flights',         icon: 'flights' },
    { path: '/itinerary',      label: 'Itinerary',       icon: 'itinerary' },
    { path: '/accommodations', label: 'Stays',           icon: 'stays' },
    { path: '/map',            label: 'Map',             icon: 'map' },
    { path: '/transportation', label: 'Transportation',  icon: 'car' },
    { path: '/finance',        label: 'Finance',         icon: 'finance' },
    { path: '/expenses',       label: 'My Expenses',     icon: 'expenses' },
    { path: '/recs',           label: 'Recs',            icon: 'recs' },
    { path: '/packing',        label: 'Packing',         icon: 'packing' },
    { path: '/outfits',        label: 'Outfits',         icon: 'outfits' },
    { path: '/trip-settings',  label: 'Trip Settings',   icon: 'settings' },
    { path: '/profile',        label: 'Profile',         icon: 'profile' },
  ];

  readonly navItems = computed<NavItem[]>(() => {
    // Hide pages this member toggled off for the active trip (TP-15).
    const hidden = this.tripService.hiddenPages();
    const items = this.baseNavItems.filter(i => !hidden.includes(i.path.slice(1)));
    if (this.userService.isAdmin()) {
      items.push({ path: '/admin', label: 'Admin', icon: 'admin' });
    }
    return items;
  });

  // ── Bottom tab bar (mobile) — 3 primary tabs + a "More" sheet for the rest ──
  readonly TAB_PATHS = ['/home', '/itinerary', '/finance'];
  readonly tabItems = computed<NavItem[]>(() =>
    this.TAB_PATHS.map(p => this.baseNavItems.find(i => i.path === p)!).filter(Boolean),
  );
  readonly moreItems = computed<NavItem[]>(() =>
    this.navItems().filter(i => !this.TAB_PATHS.includes(i.path)),
  );
  moreOpen = signal(false);
  private currentUrl = signal(this.router.url);
  /** True when the active route lives under the "More" menu (highlights the More tab). */
  readonly moreActive = computed(() => {
    const url = this.currentUrl();
    return !this.TAB_PATHS.some(p => url.startsWith(p));
  });

  toggleMore(): void { this.moreOpen.update(v => !v); }
  closeMore(): void  { this.moreOpen.set(false); }

  currentUser = this.userService.currentUser;

  constructor() {
    // Track the active URL (for the More-tab highlight) and close the sheet on navigation.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => { this.currentUrl.set(e.urlAfterRedirects); this.closeMore(); });

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
    const url = this.router.url;
    // Full-screen, no-nav layout for the auth + onboarding screens (TP-25).
    return ['/login', '/join', '/signup', '/get-started'].some(p => url.startsWith(p));
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
