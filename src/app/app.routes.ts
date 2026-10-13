import { Routes } from '@angular/router';
import { Login } from '@features/auth/presentation/views/login/login';
import { Register } from '@features/auth/presentation/views/register/register';
import { NotFoundLayout } from '@core/presentation/pages/not-found-layout/not-found-layout';
import { AppLayoutComponent } from '@core/presentation/pages/app-layout/app-layout.component';
import { authGuard } from '@core/domain/guards/auth.guard';
import { guestGuard } from '@core/domain/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      // Bienvenida provisional. Aquí entran los 3 componentes del onboarding (MD-74, MD-78, MD-85)
      // y el dashboard cuando se reconstruya.
      {
        path: '',
        loadComponent: () => import('@features/home/presentation/views/home/home').then(m => m.Home),
        pathMatch: 'full',
      },
      // Componente 1 del onboarding: el cliente cuenta de qué trata su empresa.
      {
        path: 'onboarding',
        loadComponent: () => import('@features/onboarding/presentation/views/organizational-context/organizational-context').then(m => m.OrganizationalContextView),
      },
      // Componente 2 del onboarding: los servicios de la empresa. `new` va antes que `:id`.
      {
        path: 'services',
        loadComponent: () => import('@features/services/presentation/views/services-list/services-list').then(m => m.ServicesListView),
      },
      {
        path: 'services/new',
        loadComponent: () => import('@features/services/presentation/views/service-form/service-form').then(m => m.ServiceFormView),
      },
      // El servicio del cliente: su información y las conexiones con las que Monkey llega a sus activos (Componente 3).
      // Las rutas más específicas van antes que `:id`.
      {
        path: 'services/:id/connections/new',
        loadComponent: () => import('@features/technical-control/presentation/views/new-connection/new-connection').then(m => m.NewConnectionView),
      },
      // El paso a paso de una plataforma elegida en el marketplace (D67).
      {
        path: 'services/:id/connections/new/:catalog/:platform',
        loadComponent: () => import('@features/technical-control/presentation/views/connect-platform/connect-platform').then(m => m.ConnectPlatformView),
      },
      {
        path: 'services/:id/connections/:assetId',
        loadComponent: () => import('@features/technical-control/presentation/views/connection-detail/connection-detail').then(m => m.ConnectionDetailView),
      },
      {
        path: 'services/:id/edit',
        loadComponent: () => import('@features/services/presentation/views/service-form/service-form').then(m => m.ServiceFormView),
      },
      // Enlace de la pantalla anterior (el paso «control técnico» ya no existe como pantalla aparte).
      { path: 'services/:id/technical-control', redirectTo: '/services/:id' },
      {
        path: 'services/:id',
        loadComponent: () => import('@features/services/presentation/views/service-detail/service-detail').then(m => m.ServiceDetailView),
      },
    ]
  },
  // auth pages: solo para quien no tiene sesión (con sesión, `guestGuard` lo manda adentro)
  {
    path: 'signin',
    component: Login,
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    component: Register,
    canActivate: [guestGuard],
  },
  // error pages
  {
    path: '**',
    component: NotFoundLayout
  },
];
