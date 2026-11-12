import { Routes } from '@angular/router';
import { Login } from '@features/auth/presentation/views/login/login';
import { Register } from '@features/auth/presentation/views/register/register';
import { Mfa } from '@features/auth/presentation/views/mfa/mfa';
import { ForgotPassword } from '@features/auth/presentation/views/forgot-password/forgot-password';
import { ResetPassword } from '@features/auth/presentation/views/reset-password/reset-password';
import { NotFoundLayout } from '@core/presentation/pages/not-found-layout/not-found-layout';
import { AppLayoutComponent } from '@core/presentation/pages/app-layout/app-layout.component';
import { authGuard } from '@core/domain/guards/auth.guard';
import { guestGuard } from '@core/domain/guards/guest.guard';
import { roleGuard } from '@core/domain/guards/role.guard';
import { ONBOARDING_ROLE } from '@shared/domain/utils/roles';
import { workLandingGuard } from '@core/domain/guards/work-landing.guard';
import { legacyComplianceRedirectGuard } from '@features/compliance/domain/guards/legacy-compliance-redirect.guard';
import { risksEvaluatedGuard } from '@features/services/domain/guards/risks-evaluated.guard';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      // Bienvenida provisional. El onboarding es solo el contexto de la empresa (D89); los servicios se declaran desde «Mis servicios» o desde Cumplimiento.
      // El dashboard la reemplaza cuando se reconstruya.
      // El responsable y el delegado no entran aquí: el guard los manda a «Mi trabajo» (D102, MD-196).
      {
        path: '',
        title: 'PAGE_TITLE.HOME',
        canActivate: [workLandingGuard],
        loadComponent: () => import('@features/home/presentation/views/home/home').then(m => m.Home),
        pathMatch: 'full',
      },
      // Pantallas provisionales de D102: se reemplazan al cambiar su `loadComponent` cuando el Backend las permita («Mi trabajo»: MD-201 con MD-195; asignación: MD-199 y MD-200 con MD-192).
      {
        path: 'mi-trabajo',
        title: 'PAGE_TITLE.MY_WORK',
        canActivate: [roleGuard('responsable', 'delegado')],
        data: { titleKey: 'SHELL.NAV.MY_WORK', icon: 'assignment_ind' },
        loadComponent: () => import('@core/presentation/pages/coming-soon/coming-soon').then(m => m.ComingSoonView),
      },
      {
        path: 'asignacion',
        title: 'PAGE_TITLE.ASSIGNMENT',
        canActivate: [roleGuard('admin_empresa', 'responsable')],
        data: { titleKey: 'SHELL.NAV.ASSIGNMENT', icon: 'assignment_turned_in' },
        loadComponent: () => import('@core/presentation/pages/coming-soon/coming-soon').then(m => m.ComingSoonView),
      },
      // Componente 1 del onboarding: el cliente cuenta de qué trata su empresa.
      {
        path: 'onboarding',
        title: 'PAGE_TITLE.ONBOARDING',
        canActivate: [roleGuard(ONBOARDING_ROLE)],
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
      // Cumplimiento (MD-119) es un grupo del menú: `/cumplimiento` (sin sección) es el General o la entrada, y cada sección es una página de `/cumplimiento/<sección>`.
      // El servicio activo no va en la ruta: lo elige el selector del encabezado y se recuerda (`ActiveComplianceService`). Cada sección muestra un contenido provisional
      // hasta que su historia cambie el `loadComponent`. Ya son reales: resumen (MD-140), controles (MD-120, MD-121), riesgos y causas (MD-124), evidencias (MD-129).
      {
        path: 'cumplimiento',
        pathMatch: 'full',
        title: 'PAGE_TITLE.COMPLIANCE',
        loadComponent: () => import('@features/compliance/presentation/views/compliance-entry/compliance-entry').then(m => m.ComplianceEntryView),
      },
      // El equipo de la empresa (D96, D102): lo gestiona el administrador; el responsable ve a su equipo de delegados y crea delegados para él. Personas, Grupos y Organigrama son tres
      // subítems del grupo Equipo del menú; `/equipo` redirige a Personas. El guard es del padre y vale para las dos.
      {
        path: 'equipo',
        canActivate: [roleGuard('admin_empresa', 'responsable')],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'personas' },
          {
            path: 'personas',
            title: 'PAGE_TITLE.TEAM_PEOPLE',
            loadComponent: () => import('@features/team/presentation/views/team-people/team-people').then(m => m.TeamPeopleView),
          },
          {
            path: 'grupos',
            title: 'PAGE_TITLE.TEAM_GROUPS',
            loadComponent: () => import('@features/team/presentation/views/team-groups/team-groups').then(m => m.TeamGroupsView),
          },
          {
            path: 'organigrama',
            title: 'PAGE_TITLE.TEAM_ORG',
            loadComponent: () => import('@features/team/presentation/views/team-org/team-org').then(m => m.TeamOrgView),
          },
        ],
      },
      // Los cargos responsables son de la organización, no de un servicio (MD-135).
      {
        path: 'responsables',
        title: 'PAGE_TITLE.RESPONSIBLES',
        loadComponent: () => import('@features/compliance/presentation/views/responsibles/responsibles').then(m => m.ResponsiblesView),
      },
      {
        path: 'cumplimiento',
        loadComponent: () => import('@features/compliance/presentation/views/compliance-shell/compliance-shell').then(m => m.ComplianceShellView),
        children: [
          {
            path: 'resumen',
            title: 'PAGE_TITLE.COMPLIANCE_OVERVIEW',
            loadComponent: () => import('@features/compliance/presentation/views/overview/overview').then(m => m.OverviewView),
          },
          // El orden de las rutas es el del menú: riesgos → causas → controles → evidencias.
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
      // Las rutas viejas de Cumplimiento dentro de un servicio redirigen a las nuevas y fijan ese servicio como activo (el guard siempre devuelve una redirección).
      { path: 'services/:id/cumplimiento', pathMatch: 'full', canActivate: [legacyComplianceRedirectGuard], children: [] },
      { path: 'services/:id/cumplimiento/:tab', canActivate: [legacyComplianceRedirectGuard], children: [] },
      // Enlace de la pantalla anterior (el paso «control técnico» ya no existe como pantalla aparte).
      { path: 'services/:id/technical-control', redirectTo: '/services/:id' },
      {
        path: 'services/:id',
        title: 'PAGE_TITLE.SERVICE',
        loadComponent: () => import('@features/services/presentation/views/service-detail/service-detail').then(m => m.ServiceDetailView),
      },
    ]
  },
  // Ajustes (desde el menú de perfil): una pantalla completa FUERA del layout de la app (sin su menú ni su encabezado), con «Volver a la aplicación». Menú por función a la
  // izquierda y la sección a la derecha; hoy, Seguridad (contraseña y códigos de recuperación; D101, SEG-14). Es una ruta real, en la misma pestaña.
  {
    path: 'ajustes',
    canActivate: [authGuard],
    loadComponent: () => import('@features/settings/presentation/views/settings-shell/settings-shell').then(m => m.SettingsShellView),
    children: [
      { path: '', redirectTo: 'seguridad', pathMatch: 'full' },
      // Cada sección es un resumen con sus categorías; las opciones con «>» abren su detalle (con «← Atrás»). Las rutas más específicas van antes.
      {
        path: 'seguridad/contrasena',
        title: 'PAGE_TITLE.SETTINGS_PASSWORD',
        loadComponent: () => import('@features/settings/presentation/views/password/password').then(m => m.PasswordSettingsView),
      },
      {
        path: 'seguridad/codigos-de-recuperacion',
        title: 'PAGE_TITLE.SETTINGS_RECOVERY',
        loadComponent: () => import('@features/settings/presentation/views/recovery-codes/recovery-codes').then(m => m.RecoveryCodesSettingsView),
      },
      {
        path: 'seguridad',
        title: 'PAGE_TITLE.SETTINGS_SECURITY',
        loadComponent: () => import('@features/settings/presentation/views/security/security').then(m => m.SecurityView),
      },
    ],
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
  // Recuperar la contraseña (D101): se pide desde el inicio de sesión (sin sesión) o desde Ajustes; el enlace del correo abre `reset-password`, que sirve con o sin sesión.
  {
    path: 'forgot-password',
    title: 'PAGE_TITLE.FORGOT_PASSWORD',
    component: ForgotPassword,
  },
  {
    path: 'reset-password',
    title: 'PAGE_TITLE.RESET_PASSWORD',
    component: ResetPassword,
  },
  // error pages
  {
    path: '**',
    title: 'PAGE_TITLE.NOT_FOUND',
    component: NotFoundLayout
  },
];
