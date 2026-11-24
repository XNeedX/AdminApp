import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'sign-in',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/sign-in-page/sign-in-page.component').then(
        (m) => m.SignInPageComponent
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'appointments',
        canActivate: [roleGuard('Receptionist')],
        loadComponent: () =>
          import(
            './features/appointments/pages/appointments-page/appointments-page.component'
          ).then((m) => m.AppointmentsPageComponent),
      },
      {
        path: 'doctors',
        canActivate: [roleGuard('Receptionist')],
        loadComponent: () =>
          import('./features/doctors/pages/doctors-page/doctors-page.component').then(
            (m) => m.DoctorsPageComponent
          ),
      },
      // `receptionists` and `receptionists/:id/profile` both use full path matching, so
      // their order is not significant; the tab is served by the list route below.
      {
        path: 'receptionists',
        canActivate: [roleGuard('Receptionist')],
        loadComponent: () =>
          import(
            './features/receptionists/pages/receptionists-page/receptionists-page.component'
          ).then((m) => m.ReceptionistsPageComponent),
      },
      {
        path: 'receptionists/:id/profile',
        canActivate: [roleGuard('Receptionist')],
        loadComponent: () =>
          import(
            './features/receptionists/pages/receptionist-profile-page/receptionist-profile-page.component'
          ).then((m) => m.ReceptionistProfilePageComponent),
      },
      {
        path: 'doctors/:id/profile',
        canActivate: [roleGuard('Receptionist')],
        loadComponent: () =>
          import('./features/profile/pages/profile-page/profile-page.component').then(
            (m) => m.ProfilePageComponent
          ),
      },
      {
        path: 'services',
        canActivate: [roleGuard('Receptionist')],
        loadComponent: () =>
          import('./features/services/pages/services-page/services-page.component').then(
            (m) => m.ServicesPageComponent
          ),
      },
      {
        path: 'services/:id',
        canActivate: [roleGuard('Receptionist')],
        loadComponent: () =>
          import('./features/services/pages/service-info/service-info.component').then(
            (m) => m.ServiceInfoComponent
          ),
      },
      {
        path: 'specializations',
        canActivate: [roleGuard('Receptionist')],
        loadComponent: () =>
          import(
            './features/specializations/pages/specializations-page/specializations-page.component'
          ).then((m) => m.SpecializationsPageComponent),
      },
      {
        path: 'specializations/:id',
        canActivate: [roleGuard('Receptionist')],
        loadComponent: () =>
          import(
            './features/specializations/pages/specialization-info/specialization-info.component'
          ).then((m) => m.SpecializationInfoComponent),
      },
      {
        path: 'profile',
        canActivate: [roleGuard('Doctor')],
        loadComponent: () =>
          import('./features/profile/pages/profile-page/profile-page.component').then(
            (m) => m.ProfilePageComponent
          ),
      },
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/auth/pages/home-redirect/home-redirect.component').then(
            (m) => m.HomeRedirectComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
