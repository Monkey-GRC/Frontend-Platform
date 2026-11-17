import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SessionService } from '@core/domain/services/session.service';
import { isUuid } from '@shared/domain/utils/uuid';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { ProviderLogo } from '@shared/presentation/components/provider-logo/provider-logo';
import { Section } from '@shared/presentation/components/section/section';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { TabItem, Tabs } from '@shared/presentation/components/tabs/tabs';
import { IntegrationDetail } from '@features/integrations/domain/models/integration.models';
import { IntegrationService } from '@features/integrations/domain/services/integration.service';
import { integrationTone } from '@features/integrations/domain/utils/integration-look';
import { IntegrationConnectModal } from '@features/integrations/presentation/components/integration-connect-modal/integration-connect-modal';
import { IntegrationConnections } from '@features/integrations/presentation/components/integration-connections/integration-connections';
import { IntegrationCoverage } from '@features/integrations/presentation/components/integration-coverage/integration-coverage';
import { IntegrationPermissions } from '@features/integrations/presentation/components/integration-permissions/integration-permissions';
import { IntegrationSecurity } from '@features/integrations/presentation/components/integration-security/integration-security';
import { IntegrationSidePanel } from '@features/integrations/presentation/components/integration-side-panel/integration-side-panel';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type Stage = 'loading' | 'error' | 'not_found' | 'ready';
type TabId = 'overview' | 'connections' | 'permissions' | 'evaluates' | 'security';

// El detalle de una integración (MD-211): cabecera, pestañas a la izquierda y panel lateral a la derecha (en móvil, el panel va antes de las pestañas).
// La pestaña activa vive en `?tab=`. El botón de conectar es solo del administrador y solo si la integración está disponible.
// Con `?service=<id>` (se llega desde las conexiones de un servicio) «Conectar» ya lleva ese servicio: no lo pregunta y entra directo al asistente; sin él pide el servicio en un modal.
// El id solo se usa si es un uuid; si no, se ignora.
@Component({
  selector: 'app-integration-detail',
  imports: [NgTemplateOutlet, RouterLink, TranslatePipe, EmptyState, ProviderLogo, StatusIndicator, Tabs, Section, IntegrationSidePanel, IntegrationConnections, IntegrationPermissions, IntegrationCoverage, IntegrationSecurity, IntegrationConnectModal, Skeleton, SkeletonRegion],
  templateUrl: './integration-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationDetailView {
  private readonly api = inject(IntegrationService);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly labels = inject(EnumLabelService);

  readonly stage = signal<Stage>('loading');
  readonly detail = signal<IntegrationDetail | null>(null);
  readonly connecting = signal(false);

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  readonly isAdmin = computed(() => this.session.user()?.role === 'admin_empresa');
  readonly comingSoon = computed(() => this.detail()?.availability === 'coming_soon');
  readonly tone = integrationTone;

  readonly tabs = computed<TabItem[]>(() => {
    const ids: TabId[] = ['overview', ...((this.detail()?.connection_count ?? 0) > 0 ? (['connections'] as TabId[]) : []), 'permissions', 'evaluates', 'security'];
    return ids.map((id) => ({ id, labelKey: 'INTEGRATIONS.DETAIL.TABS.' + id.toUpperCase() }));
  });

  /** La pestaña pedida en `?tab=`; una desconocida (o «Conexiones» sin conexiones) cae en Resumen. */
  readonly tab = computed(() => {
    const wanted = this.query().get('tab');
    return this.tabs().some((t) => t.id === wanted) ? (wanted as TabId) : 'overview';
  });

  /** El servicio desde el que se llegó, si vino con uno válido. */
  readonly serviceId = computed(() => {
    const id = this.query().get('service');
    return isUuid(id) ? id : null;
  });

  /** Desde un servicio se vuelve a sus conexiones. Una integración sin conectar se llega desde «Agregar» (si eres administrador); si no, desde la lista. */
  readonly backLink = computed<string[]>(() => {
    const service = this.serviceId();
    if (service) return ['/services', service, 'connections', 'new'];
    return !this.detail()?.connected && this.isAdmin() ? ['/integraciones/agregar'] : ['/integraciones'];
  });
  readonly backLabelKey = computed(() => (this.serviceId() ? 'INTEGRATIONS.DETAIL.BACK_SERVICE' : this.backLink()[0] === '/integraciones' ? 'INTEGRATIONS.DETAIL.BACK_LIST' : 'INTEGRATIONS.DETAIL.BACK_ADD'));

  constructor() {
    // El idioma no cambia durante la sesión (cambiarlo recarga la app): se pide una sola vez.
    this.load();
  }

  load(): void {
    const code = this.route.snapshot.paramMap.get('code') ?? '';
    const firstLoad = this.stage() !== 'ready';
    if (firstLoad) this.stage.set('loading');
    this.api.getDetail(code).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.stage.set('ready');
      },
      error: (e: unknown) => {
        if (firstLoad) this.stage.set(e instanceof HttpErrorResponse && e.status === 404 ? 'not_found' : 'error');
      },
    });
  }

  /** «Conectar»: con un servicio ya elegido va directo al asistente; si no, se elige el servicio. */
  connect(): void {
    const service = this.serviceId();
    const connection = this.detail()?.connection;
    if (!service || !connection) {
      this.connecting.set(true);
      return;
    }
    void this.router.navigate(['/services', service, 'connections', 'new', connection.category, connection.platform], { queryParams: { returnTo: this.router.url } });
  }

  selectTab(id: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: id }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
