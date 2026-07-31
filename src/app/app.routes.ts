import { Routes } from '@angular/router';
import { Login } from '@features/auth/presentation/views/login/login';
import { NotFoundLayout } from '@core/presentation/pages/not-found-layout/not-found-layout';
import { Home } from '@features/common/presentation/view/home/home';
import { AppLayoutComponent } from '@core/presentation/pages/app-layout/app-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: '',
        component: Home,
        pathMatch: 'full',
      },
    ]
  },
  // auth pages
  {
    path: 'signin',
    component: Login
  },
  // error pages
  {
    path: '**',
    component: NotFoundLayout
  },
];
