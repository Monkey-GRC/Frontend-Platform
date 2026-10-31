import { Routes } from '@angular/router';
import { Login } from '@features/auth/presentation/views/login/login';
import { Register } from '@features/auth/presentation/views/register/register';
import { Mfa } from '@features/auth/presentation/views/mfa/mfa';
import { NotFoundLayout } from '@core/presentation/pages/not-found-layout/not-found-layout';
import { AppLayoutComponent } from '@core/presentation/pages/app-layout/app-layout.component';
import { authGuard } from '@core/domain/guards/auth.guard';
import { guestGuard } from '@core/domain/guards/guest.guard';
import { roleGuard } from '@core/domain/guards/role.guard';
import { risksEvaluatedGuard } from '@features/services/domain/guards/risks-evaluated.guard';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      // Bienvenida provisional. El onboarding es solo el contexto de la empresa (D89); los servicios se declaran desde «Mis servicios» o desde Cumplimiento.
      // El dashboard la reemplaza cuando se reconstruya.
      {
        path: '',
        title: 'PAGE_TITLE.HOME',
        loadComponent: () => import('@features/home/presentation/views/home/home').then(m => m.Home),
        pathMatch: 'full',
      },
      // Componente 1 del onboarding: el cliente cuenta de qué trata su empresa.
      {
        path: 'onboarding',
        title: 'PAGE_TITLE.ONBOARDING',
        loadComponent: () => import('@features/onboarding/presentation/views/organizational-context/organizational-context').then(m => m.OrganizationalContextView),
      },
      // Los servicios de la empresa (antes, Componente 2 del onboarding; desde D89 se declaran cuando el cliente quiera). `new` va antes que `:id`.
      {
        path: 'services',
        title: 'PAGE_TITLE.SERVICES',
        loadComponent: () => import('@features/services/presentation/views/services-list/services-list').then(m => m.ServicesListView),
      },
      {
        path: 'services/new',
        title: 'PAGE_TITLE.SERVICE_NEW',
        loadComponent: () => import('@features/services/presentation/views/service-form/service-form').then(m => m.ServiceFormView),
      },
      // El servicio del cliente: su información y las conexiones con las que Monkey llega a sus activos (Componente 3).
      // Las rutas más específicas van antes que `:id`.
      // D89: no se declaran activos hasta evaluar los riesgos del servicio (el guard manda a evaluarlos).
      {
        path: 'services/:id/connections/new',
        title: 'PAGE_TITLE.CONNECTION_NEW',
        canActivate: [risksEvaluatedGuard],
        loadComponent: () => import('@features/technical-control/presentation/views/new-connection/new-connection').then(m => m.NewConnectionView),
      },
      // El paso a paso de una plataforma elegida en el marketplace (D67).
      {
        path: 'services/:id/connections/new/:catalog/:platform',
        title: 'PAGE_TITLE.CONNECT_PLATFORM',
        canActivate: [risksEvaluatedGuard],
        loadComponent: () => import('@features/technical-control/presentation/views/connect-platform/connect-platform').then(m => m.ConnectPlatformView),
      },
      {
        path: 'services/:id/connections/:assetId',
        title: 'PAGE_TITLE.CONNECTION',
        loadComponent: () => import('@features/technical-control/presentation/views/connection-detail/connection-detail').then(m => m.ConnectionDetailView),
      },
      {
        path: 'services/:id/edit',
        title: 'PAGE_TITLE.SERVICE_EDIT',
        loadComponent: () => import('@features/services/presentation/views/service-form/service-form').then(m => m.ServiceFormView),
      },
      // Cumplimiento (MD-119): entrada del menú y, dentro de cada servicio, el módulo con sus pestañas. Cada pestaña muestra
      // un contenido provisional hasta que su historia cambie el `loadComponent` (resumen MD-140 y evidencias MD-129). Ya son reales:
      // controles (MD-120, MD-121), riesgos y causas (MD-124). Las rutas más específicas van antes que `services/:id`.
      {
        path: 'cumplimiento',
        title: 'PAGE_TITLE.COMPLIANCE',
        loadComponent: () => import('@features/compliance/presentation/views/compliance-entry/compliance-entry').then(m => m.ComplianceEntryView),
      },
      // El equipo de la empresa y el reparto del trabajo por dimensión (D96): lo gestiona el administrador.
      {
        path: 'equipo',
        title: 'PAGE_TITLE.TEAM',
        canActivate: [roleGuard('admin_empresa')],
        loadComponent: () => import('@features/team/presentation/views/team/team').then(m => m.TeamView),
      },
      // Los cargos responsables son de la organización, no de un servicio (MD-135).
      {
        path: 'responsables',
        title: 'PAGE_TITLE.RESPONSIBLES',
        loadComponent: () => import('@features/compliance/presentation/views/responsibles/responsibles').then(m => m.ResponsiblesView),
      },
      {
        path: 'services/:id/cumplimiento',
        loadComponent: () => import('@features/compliance/presentation/views/compliance-shell/compliance-shell').then(m => m.ComplianceShellView),
        children: [
          // Se entra por el Resumen (MD-140): el estado del servicio antes que el detalle.
          { path: '', redirectTo: 'resumen', pathMatch: 'full' },
          {
            path: 'resumen',
            title: 'PAGE_TITLE.COMPLIANCE_OVERVIEW',
            loadComponent: () => import('@features/compliance/presentation/views/overview/overview').then(m => m.OverviewView),
          },
          // El orden de las rutas es el de las pestañas: riesgos → causas → controles → evidencias.
          // Riesgos y Causas son la misma vista con dos rutas: una causa no depende de un riesgo (10 de las 56 del catálogo no pertenecen a ninguno).
          {
            path: 'riesgos',
            title: 'PAGE_TITLE.COMPLIANCE_RISKS',
            data: { section: 'risks' },
            loadComponent: () => import('@features/compliance/presentation/views/risks/risks').then(m => m.RisksView),
          },
          {
            path: 'causas',
            title: 'PAGE_TITLE.COMPLIANCE_CAUSES',
            data: { section: 'causes' },
            loadComponent: () => import('@features/compliance/presentation/views/risks/risks').then(m => m.RisksView),
          },
          {
            path: 'controles',
            title: 'PAGE_TITLE.COMPLIANCE_CONTROLS',
            loadComponent: () => import('@features/compliance/presentation/views/controls-list/controls-list').then(m => m.ControlsListView),
          },
          // Antes se llamaba «acciones»: se conserva el enlace viejo.
          { path: 'acciones', redirectTo: 'controles', pathMatch: 'full' },
          {
            path: 'evidencias',
            title: 'PAGE_TITLE.COMPLIANCE_EVIDENCE',
            loadComponent: () => import('@features/compliance/presentation/views/evidence-inbox/evidence-inbox').then(m => m.EvidenceInboxView),
          },
          {
            path: 'exclusiones',
            title: 'PAGE_TITLE.COMPLIANCE_EXCLUSIONS',
            loadComponent: () => import('@features/compliance/presentation/views/exclusions/exclusions').then(m => m.ExclusionsView),
          },
        ],
      },
      // Enlace de la pantalla anterior (el paso «control técnico» ya no existe como pantalla aparte).
      { path: 'services/:id/technical-control', redirectTo: '/services/:id' },
      {
        path: 'services/:id',
        title: 'PAGE_TITLE.SERVICE',
        loadComponent: () => import('@features/services/presentation/views/service-detail/service-detail').then(m => m.ServiceDetailView),
      },
    ]
  },
  // auth pages: solo para quien no tiene sesión (con sesión, `guestGuard` lo manda adentro)
  {
    path: 'signin',
    title: 'PAGE_TITLE.SIGNIN',
    component: Login,
    canActivate: [guestGuard],
  },
  {
    path: 'mfa',
    title: 'PAGE_TITLE.MFA',
    component: Mfa,
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    title: 'PAGE_TITLE.REGISTER',
    component: Register,
    canActivate: [guestGuard],
  },
  // error pages
  {
    path: '**',
    title: 'PAGE_TITLE.NOT_FOUND',
    component: NotFoundLayout
  },
];
