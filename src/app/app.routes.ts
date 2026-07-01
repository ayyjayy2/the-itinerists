import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'join',
    loadComponent: () => import('./pages/join/join.component').then(m => m.JoinComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup.component').then(m => m.SignupComponent)
  },
  {
    path: 'get-started',
    loadComponent: () => import('./pages/get-started/get-started.component').then(m => m.GetStartedComponent),
    canActivate: [authGuard]
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'trips',
    loadComponent: () => import('./pages/my-trips/my-trips.component').then(m => m.MyTripsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'trips/new',
    loadComponent: () => import('./pages/create-trip/create-trip.component').then(m => m.CreateTripComponent),
    canActivate: [authGuard]
  },
  {
    path: 'trip-settings',
    loadComponent: () => import('./pages/trip-settings/trip-settings.component').then(m => m.TripSettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'flights',
    loadComponent: () => import('./pages/flights/flights.component').then(m => m.FlightsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'itinerary',
    loadComponent: () => import('./pages/itinerary/itinerary.component').then(m => m.ItineraryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'accommodations',
    loadComponent: () => import('./pages/accommodations/accommodations.component').then(m => m.AccommodationsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'finance',
    loadComponent: () => import('./pages/finance/finance.component').then(m => m.FinanceComponent),
    canActivate: [authGuard]
  },
  {
    path: 'expenses',
    loadComponent: () => import('./pages/expenses/expenses.component').then(m => m.ExpensesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'recs',
    loadComponent: () => import('./pages/recs/recs.component').then(m => m.RecsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'packing',
    loadComponent: () => import('./pages/packing-list/packing-list.component').then(m => m.PackingListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'outfits',
    loadComponent: () => import('./pages/outfits/outfits.component').then(m => m.OutfitsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [adminGuard]
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];
