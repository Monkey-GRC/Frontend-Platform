import { Routes } from '@angular/router';
import { Login } from '@features/auth/presentation/views/login/login';
import { Register } from '@features/auth/presentation/views/register/register';
import { NotFoundLayout } from '@core/presentation/pages/not-found-layout/not-found-layout';
import { AppLayoutComponent } from '@core/presentation/pages/app-layout/app-layout.component';
import { authGuard } from '@core/domain/guards/auth.guard';

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
    ]
  },
  // auth pages
  {
    path: 'signin',
    component: Login
  },
  {
    path: 'register',
    component: Register
  },
  // error pages
  {
    path: '**',
    component: NotFoundLayout
  },
];
