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
      // Aqui entran los 3 componentes del onboarding (MD-74, MD-78, MD-85)
      // y el dashboard cuando se reconstruya.
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
