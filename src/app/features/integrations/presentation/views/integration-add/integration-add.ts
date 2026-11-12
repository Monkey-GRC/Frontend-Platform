import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { forkJoin } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogIntegration } from '@features/integrations/domain/models/integration.models';
import { IntegrationService } from '@features/integrations/domain/services/integration.service';
import { IntegrationConnectModal } from '@features/integrations/presentation/components/integration-connect-modal/integration-connect-modal';
import { IntegrationCard } from '@features/integrations/presentation/components/integration-card/integration-card';

type Stage = 'loading' | 'error' | 'ready';

// «Agregar integración» (solo administrador): el catálogo que manda el backend, por propósito (las secciones y su orden salen del catálogo `integration_purpose`). Conectar lleva al flujo que ya existe por servicio.
@Component({
  selector: 'app-integration-add',
  imports: [PageHeader, LoadingSpinner, TranslatePipe, TableToolbar, EmptyState, IntegrationConnectModal, IntegrationCard],
  templateUrl: './integration-add.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationAddView {
  private readonly api = inject(IntegrationService);
  private readonly catalog = inject(CatalogService);

  readonly stage = signal<Stage>('loading');
  readonly items = signal<CatalogIntegration[]>([]);
  readonly purposes = signal<CatalogOption[]>([]);
  readonly query = signal('');
  readonly picking = signal<CatalogIntegration | null>(null);

  readonly sections = computed(() => {
    const q = this.query().trim().toLowerCase();
    const found = q ? this.items().filter((i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)) : this.items();
    return this.purposes()
      .map((purpose, index) => ({ purpose: purpose.value, title: `${index + 1}. ${purpose.label}`, items: found.filter((i) => i.purpose === purpose.value) }))
      .filter((s) => s.items.length > 0);
  });

  constructor() {
    // El idioma no cambia durante la sesión (cambiarlo recarga la app): se pide una sola vez.
    this.load();
  }

  load(): void {
    const firstLoad = this.stage() !== 'ready';
    if (firstLoad) this.stage.set('loading');
    forkJoin([this.api.catalog(), this.catalog.options('integration_purpose')]).subscribe({
      next: ([items, purposes]) => {
        this.items.set(items);
        this.purposes.set(purposes);
        this.stage.set('ready');
      },
      error: () => {
        if (firstLoad) this.stage.set('error');
      },
    });
  }

  /** Conectar: se abre el modal que pide el servicio y sigue por el flujo de conexión de ese servicio. */
  connect(item: CatalogIntegration): void {
    this.picking.set(item);
  }
}
