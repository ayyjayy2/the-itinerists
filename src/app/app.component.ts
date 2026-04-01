import { Component, OnInit, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { UserService } from './services/user.service';
import { DataService } from './services/data.service';
import { ExpensesService } from './services/expenses.service';
import { PackingService } from './services/packing.service';
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
  userService = inject(UserService);
  dataService = inject(DataService);
  expensesService = inject(ExpensesService);
  packingService = inject(PackingService);
  router = inject(Router);
  private swUpdate = inject(SwUpdate);

  readonly version   = APP_VERSION;
  readonly buildDate = APP_BUILD_DATE;
  sidebarOpen   = false;
  navCollapsed  = localStorage.getItem('ireland_nav_collapsed') === 'true';

  readonly navItems: NavItem[] = [
    { path: '/home',           label: 'Home',           icon: '🏠' },
    { path: '/flights',        label: 'Flights',        icon: '✈️' },
    { path: '/itinerary',      label: 'Itinerary',      icon: '📅' },
    { path: '/accommodations', label: 'Stays',          icon: '🏨' },
    { path: '/finance',        label: 'Finance',        icon: '💶' },
    { path: '/expenses',       label: 'My Expenses',    icon: '🧾' },
    { path: '/recs',           label: 'Recs',           icon: '☘️' },
    { path: '/rental-car',     label: 'Rental Car',     icon: '🚗' },
    { path: '/packing',        label: 'Packing',        icon: '🧳' },
    { path: '/outfits',        label: 'Outfits',        icon: '👗' },
    { path: '/map',            label: 'Map',            icon: '🗺️' },
  ];

  currentUser = this.userService.currentUser;
  isOnSelectUser = computed(() => this.router.url === '/select-user');

  ngOnInit(): void {
    if (!this.userService.hasUser()) {
      this.router.navigate(['/select-user']);
    } else {
      this.dataService.init();
      this.expensesService.init();
      this.packingService.init();
    }

    // Auto-apply new service worker versions so deploys take effect on next reload
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      ).subscribe(() => {
        this.swUpdate.activateUpdate().then(() => window.location.reload());
      });
    }
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

  switchUser(): void {
    this.router.navigate(['/select-user']);
    this.sidebarOpen = false;
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleCollapse(): void {
    this.navCollapsed = !this.navCollapsed;
    localStorage.setItem('ireland_nav_collapsed', String(this.navCollapsed));
  }

  isSelectUserPage(): boolean {
    return this.router.url.startsWith('/select-user');
  }
}
