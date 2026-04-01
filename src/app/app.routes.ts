import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { UserService } from './services/user.service';
import { Router } from '@angular/router';

const requireUser = () => {
  const userService = inject(UserService);
  const router = inject(Router);
  if (!userService.hasUser()) {
    router.navigate(['/select-user']);
    return false;
  }
  return true;
};

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'select-user',
    loadComponent: () => import('./pages/user-select/user-select.component').then(m => m.UserSelectComponent)
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [requireUser]
  },
  {
    path: 'flights',
    loadComponent: () => import('./pages/flights/flights.component').then(m => m.FlightsComponent),
    canActivate: [requireUser]
  },
  {
    path: 'itinerary',
    loadComponent: () => import('./pages/itinerary/itinerary.component').then(m => m.ItineraryComponent),
    canActivate: [requireUser]
  },
  {
    path: 'accommodations',
    loadComponent: () => import('./pages/accommodations/accommodations.component').then(m => m.AccommodationsComponent),
    canActivate: [requireUser]
  },
  {
    path: 'finance',
    loadComponent: () => import('./pages/finance/finance.component').then(m => m.FinanceComponent),
    canActivate: [requireUser]
  },
  {
    path: 'expenses',
    loadComponent: () => import('./pages/expenses/expenses.component').then(m => m.ExpensesComponent),
    canActivate: [requireUser]
  },
  {
    path: 'recs',
    loadComponent: () => import('./pages/recs/recs.component').then(m => m.RecsComponent),
    canActivate: [requireUser]
  },
  {
    path: 'rental-car',
    loadComponent: () => import('./pages/rental-car/rental-car.component').then(m => m.RentalCarComponent),
    canActivate: [requireUser]
  },
  {
    path: 'packing',
    loadComponent: () => import('./pages/packing-list/packing-list.component').then(m => m.PackingListComponent),
    canActivate: [requireUser]
  },
  {
    path: 'outfits',
    loadComponent: () => import('./pages/outfits/outfits.component').then(m => m.OutfitsComponent),
    canActivate: [requireUser]
  },
  {
    path: 'map',
    loadComponent: () => import('./pages/map/map.component').then(m => m.MapComponent),
    canActivate: [requireUser]
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];
