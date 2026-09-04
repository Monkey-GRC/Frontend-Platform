import { Routes } from '@angular/router';
import { Login } from '@features/auth/presentation/views/login/login';
import { Register } from '@features/auth/presentation/views/register/register';
import { NotFoundLayout } from '@core/presentation/pages/not-found-layout/not-found-layout';
import { AppLayoutComponent } from '@core/presentation/pages/app-layout/app-layout.component';
import { Dashboard } from '@features/dashboard/presentation/views/dashboard/dashboard';
import { TemplateList } from '@features/templates/presentation/views/template-list/template-list';
import { TemplateBuilder } from '@features/templates/presentation/views/template-builder/template-builder';
import { TemplateView } from '@features/templates/presentation/views/template-view/template-view';
import { TemplateCompliance } from '@features/templates/presentation/views/template-compliance/template-compliance';
import { AssetList } from '@features/assets/presentation/views/asset-list/asset-list';
import { AssetDetail } from '@features/assets/presentation/views/asset-detail/asset-detail';
import { Characterization } from '@features/onboarding/presentation/views/characterization/characterization';
import { TemplateSelection } from '@features/onboarding/presentation/views/template-selection/template-selection';
import { AccountSetup } from '@features/onboarding/presentation/views/account-setup/account-setup';
import { CompanyProfile } from '@features/onboarding/presentation/views/company-profile/company-profile';
import { onboardingCodePresentGuard } from '@core/domain/guards/onboarding-code-present.guard';
import { characterizationCompleteGuard } from '@core/domain/guards/characterization-complete.guard';
import { templateSelectedGuard } from '@core/domain/guards/template-selected.guard';
import { authGuard } from '@core/domain/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: Dashboard,
        pathMatch: 'full',
      },
      {
        path: 'templates',
        component: TemplateList,
        data: { mode: 'compliance' },
      },
      {
        path: 'templates/:id',
        component: TemplateCompliance,
      },
      {
        path: 'templates/:id/grc',
        redirectTo: 'plantilla/:id',
      },
      {
        path: 'templates/:id/build',
        component: TemplateBuilder,
      },
      {
        path: 'plantilla',
        component: TemplateList,
        data: { mode: 'structure' },
      },
      {
        path: 'plantilla/:id',
        component: TemplateView,
      },
      {
        path: 'assets',
        component: AssetList,
      },
      {
        path: 'assets/:id',
        component: AssetDetail,
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
  // onboarding — pasos previos a tener sesión
  {
    path: 'onboarding/characterization',
    component: Characterization,
    canActivate: [onboardingCodePresentGuard],
  },
  {
    path: 'onboarding/templates',
    component: TemplateSelection,
    canActivate: [characterizationCompleteGuard],
  },
  {
    path: 'onboarding/account',
    component: AccountSetup,
    canActivate: [templateSelectedGuard],
  },
  // edición opcional del perfil de empresa, ya con sesión de tenant
  {
    path: 'onboarding/company-profile',
    component: CompanyProfile,
    canActivate: [authGuard],
  },
  // error pages
  {
    path: '**',
    component: NotFoundLayout
  },
];
