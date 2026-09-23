import { Component, OnInit, inject, computed, effect, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd, NavigationError } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IconComponent } from './shared/icon/icon.component';
import { BrandComponent } from './shared/brand/brand.component';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { UserService } from './services/user.service';
import { isStaleChunkError } from './utils/chunk-error';
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
import { DEMO } from './demo-flag';
import { effectiveHomeLayout } from './utils/layout';
import { applyNavOrder } from './utils/nav-order';
import { NotificationBellComponent } from './shared/notification-bell/notification-bell.component';
import { CdkDrag, CdkDropList, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AvatarGlyphComponent } from './shared/avatar-glyph/avatar-glyph.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, IconComponent, BrandComponent, NotificationBellComponent, CdkDrag, CdkDropList, AvatarGlyphComponent],
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
  readonly isDemo    = DEMO;
  readonly buildDate = APP_BUILD_DATE;
  sidebarOpen  = false;
  navCollapsed = localStorage.getItem('tripplanner_nav_collapsed') === 'true';

  // `icon` is a name resolved by <app-icon> (custom line-icon set), not an emoji.
  // Order: the default bottom-bar four first, everyday pages next, and the
  // settings-flavored pages (My Trips → Trip Settings → Profile) at the end.
  readonly baseNavItems: NavItem[] = [
    { path: '/home',           label: 'Home',            icon: 'home' },
    { path: '/itinerary',      label: 'Itinerary',       icon: 'itinerary' },
    { path: '/finance',        label: 'Finance',         icon: 'finance' },
    { path: '/packing',        label: 'Packing',         icon: 'packing' },
    { path: '/flights',        label: 'Flights',         icon: 'flights' },
    { path: '/accommodations', label: 'Stays',           icon: 'stays' },
    { path: '/map',            label: 'Map',             icon: 'map' },
    { path: '/transportation', label: 'Transportation',  icon: 'car' },
    { path: '/expenses',       label: 'My Expenses',     icon: 'expenses' },
    { path: '/recs',           label: 'Recs',            icon: 'recs' },
    { path: '/outfits',        label: 'Outfits',         icon: 'outfits' },
    { path: '/trips',          label: 'My Trips',        icon: 'trips' },
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

  // ── Personal nav order: Home pinned first, Admin pinned last, the rest
  //    follow users/{uid}.navOrder (account data — set via More → Reorder) ──
  readonly orderedNavItems = computed<NavItem[]>(() => {
    const items = this.navItems();
    const home  = items.filter(i => i.path === '/home');
    const admin = items.filter(i => i.path === '/admin');
    const rest  = items.filter(i => i.path !== '/home' && i.path !== '/admin');
    return [...home, ...applyNavOrder(rest, this.userService.firestoreUser()?.navOrder), ...admin];
  });

  // ── Bottom tab bar (mobile) — Home + next 3 of the personal order; the rest
  //    live in the "More" sheet ──
  readonly tabItems  = computed<NavItem[]>(() => this.orderedNavItems().slice(0, 4));
  readonly moreItems = computed<NavItem[]>(() => this.orderedNavItems().slice(4));
  moreOpen = signal(false);
  private currentUrl = signal(this.router.url);
  /** True when the active route lives under the "More" menu (highlights the More tab). */
  readonly moreActive = computed(() => {
    const url = this.currentUrl();
    return !this.tabItems().some(i => url.startsWith(i.path));
  });

  toggleMore(): void { this.moreOpen.update(v => !v); }
  closeMore(): void  { this.moreOpen.set(false); this.reorderMode.set(false); this.sheetDragY.set(0); }

  // ── Swipe-down to dismiss the More sheet (the sheet follows the finger) ────
  /** How far the finger has dragged the sheet down, in px (0 = resting). */
  sheetDragY = signal(0);
  private sheetTouchStartY: number | null = null;
  private static readonly SHEET_DISMISS_PX = 70;

  onSheetTouchStart(e: TouchEvent): void {
    // Reorder mode owns touch (cdkDrag) — don't fight it for the gesture.
    if (this.reorderMode()) return;
    this.sheetTouchStartY = e.touches[0].clientY;
  }
  onSheetTouchMove(e: TouchEvent): void {
    if (this.sheetTouchStartY === null) return;
    // Only follow downward movement; upward drags keep the sheet at rest.
    this.sheetDragY.set(Math.max(0, e.touches[0].clientY - this.sheetTouchStartY));
  }
  onSheetTouchEnd(): void {
    if (this.sheetTouchStartY === null) return;
    this.sheetTouchStartY = null;
    if (this.sheetDragY() > AppComponent.SHEET_DISMISS_PX) this.closeMore();
    else this.sheetDragY.set(0);
  }

  // ── More-sheet reorder mode: drag to rearrange; top 3 join Home in the bar ──
  reorderMode = signal(false);
  toggleReorder(): void { this.reorderMode.update(v => !v); }
  /** Everything the user may reorder (Home and Admin stay pinned). */
  readonly reorderableItems = computed<NavItem[]>(() =>
    this.orderedNavItems().filter(i => i.path !== '/home' && i.path !== '/admin'));

  dropNavItem(event: CdkDragDrop<NavItem[]>): void {
    const list = [...this.reorderableItems()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    void this.userService.updateNavOrder(list.map(i => i.path));
  }

  currentUser = this.userService.currentUser;

  // ── Type B chrome: hamburger drawer replaces sidebar/tab bar ──
  readonly isLayoutB = computed(() => effectiveHomeLayout(this.userService.firestoreUser()) === 'B');
  /** Bell lives in B and C; Type A keeps its inline home feed instead. */
  readonly showBell  = computed(() => effectiveHomeLayout(this.userService.firestoreUser()) !== 'A');
  drawerOpen = signal(false);
  toggleDrawer(): void { this.drawerOpen.update(v => !v); }
  closeDrawer(): void  { this.drawerOpen.set(false); this.drawerDragX.set(0); }

  // ── Swipe-left to dismiss the drawer (mirrors its slide-in from the left).
  //    Horizontal only — vertical touches keep scrolling the nav list. ──
  /** How far the finger has dragged the drawer left, in px (≤ 0; 0 = resting). */
  drawerDragX = signal(0);
  private drawerTouchStartX: number | null = null;
  private static readonly DRAWER_DISMISS_PX = 70;

  onDrawerTouchStart(e: TouchEvent): void {
    this.drawerTouchStartX = e.touches[0].clientX;
  }
  onDrawerTouchMove(e: TouchEvent): void {
    if (this.drawerTouchStartX === null) return;
    // Only follow leftward movement; rightward drags keep the drawer at rest.
    this.drawerDragX.set(Math.min(0, e.touches[0].clientX - this.drawerTouchStartX));
  }
  onDrawerTouchEnd(): void {
    if (this.drawerTouchStartX === null) return;
    this.drawerTouchStartX = null;
    if (this.drawerDragX() < -AppComponent.DRAWER_DISMISS_PX) this.closeDrawer();
    else this.drawerDragX.set(0);
  }
  /** Drawer list: every page, Profile included — the footer chip alone proved
   *  too subtle a path to account settings (incl. the layout picker). */
  readonly drawerItems = computed(() => this.orderedNavItems());

  constructor() {
    // Track the active URL (for the More-tab highlight) and close the sheet on navigation.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => { this.currentUrl.set(e.urlAfterRedirects); this.closeMore(); this.closeDrawer(); });

    // No service worker, so an open tab keeps the version it loaded. After a
    // deploy, the first visit to a not-yet-loaded page fails to fetch its
    // (renamed) chunk and the navigation is silently cancelled — the tap
    // "does nothing". Recover with one full reload straight to that page.
    this.router.events
      .pipe(filter((e): e is NavigationError => e instanceof NavigationError))
      .subscribe(e => {
        if (!isStaleChunkError(e.error)) return;
        const key = 'staleChunkReloadAt';
        const last = Number(sessionStorage.getItem(key) ?? 0);
        if (Date.now() - last < 60_000) return; // never loop if the reload didn't help
        sessionStorage.setItem(key, String(Date.now()));
        window.location.assign(e.url);
      });

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
