import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { Capability } from '@shared/domain/models/technical-control.models';
import { ServiceService } from '@shared/domain/services/service.service';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { categoryLabel } from '@shared/domain/utils/category-label';
import { Breadcrumb, Crumb } from '@shared/presentation/components/breadcrumb/breadcrumb';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { ProviderLogo } from '@shared/presentation/components/provider-logo/provider-logo';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { CatalogIntegration } from '@features/integrations/domain/models/integration.models';
import { IntegrationCatalog } from '@features/integrations/presentation/components/integration-catalog/integration-catalog';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type Stage = 'loading' | 'error' | 'ready';

// «Nueva conexión» de un servicio (`/services/:id/connections/new`): el MISMO catálogo de integraciones que «Agregar integración» (tarjetas, detalle y asistente de conexión son los de Integraciones),
// ya dentro del servicio: la tarjeta abre el detalle con `?service=` y «Conectar» no vuelve a preguntar el servicio. Debajo van los servidores, bases de datos y equipos (`ac_02` a `ac_06`):
// no son integraciones, se conectan con la sonda y siguen en las conexiones de cada servicio. Las plataformas sin flujo se muestran bloqueadas.
@Component({
  selector: 'app-service-new-connection',
  imports: [PageHeader, Breadcrumb, IntegrationCatalog, ProviderLogo, StatusIndicator, EmptyState, TranslatePipe, Skeleton, SkeletonRegion],
  templateUrl: './service-new-connection.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceNewConnectionView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TechnicalControlService);
  private readonly services = inject(ServiceService);
  private readonly translate = inject(TranslateService);

  readonly stage = signal<Stage>('loading');
  readonly serviceId = signal('');
  readonly serviceName = signal<string | null>(null);
  // Los tipos de conexión que no son integraciones: servidores, bases de datos y equipos.
  readonly serverGroups = signal<Capability[]>([]);

  // Mis servicios › {servicio} › Nueva conexión
  readonly crumbs = computed<Crumb[]>(() => [
    { label: this.translate.instant('SHELL.NAV.MY_SERVICES'), link: ['/services'] },
    { label: this.serviceName() ?? this.translate.instant('TECHNICAL_CONTROL.CRUMB_SERVICE'), link: ['/services', this.serviceId()] },
    { label: this.translate.instant('TECHNICAL_CONTROL.NEW_CONNECTION') },
  ]);

  ngOnInit(): void {
    this.serviceId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    const id = this.serviceId();
    forkJoin({ state: this.api.state(id), service: this.services.get(id) }).subscribe({
      next: ({ state, service }) => {
        this.serviceName.set(service.name);
        this.serverGroups.set(state.applicable_capabilities.filter((c) => c.catalog_code !== 'ac_01' && c.platforms.length > 0));
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  /** «Conectar» desde una tarjeta: el servicio ya es este, se entra directo al asistente y al cerrar se vuelve aquí. */
  connect(item: CatalogIntegration): void {
    if (!item.connection) return;
    void this.router.navigate(['/services', this.serviceId(), 'connections', 'new', item.connection.category, item.connection.platform], { queryParams: { returnTo: this.router.url } });
  }

  // El título del grupo es el nombre del tipo de conexión sin la aclaración entre paréntesis.
  groupTitle(code: string, category: string): string {
    return categoryLabel(this.translate, code, category).replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  }

  blockedLabel(name: string): string {
    return this.translate.instant('TECHNICAL_CONTROL.NEW.BLOCKED_ARIA', { name });
  }
}
