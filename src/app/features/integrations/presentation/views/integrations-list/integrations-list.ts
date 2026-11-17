import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SessionService } from '@core/domain/services/session.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { LocalDatePipe } from '@shared/presentation/pipes/local-date.pipe';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { ProviderLogo } from '@shared/presentation/components/provider-logo/provider-logo';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { TableFilter, TableFilterOption } from '@shared/presentation/components/table-filter/table-filter';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { Card } from '@shared/presentation/components/card/card';
import { Tag } from '@shared/presentation/components/tag/tag';
import { Integration } from '@features/integrations/domain/models/integration.models';
import { IntegrationService } from '@features/integrations/domain/services/integration.service';
import { attentionItems, connectionLink, integrationTone } from '@features/integrations/domain/utils/integration-look';

type Stage = 'loading' | 'error' | 'ready';

// «Integraciones»: lo que la empresa ya conectó, con su estado derivado (D110). El administrador agrega y revisa conexiones; el auditor solo lee.
@Component({
  selector: 'app-integrations-list',
  imports: [Tag, PageHeader, RouterLink, TranslatePipe, DataTable, TableCell, TableToolbar, TableFilter, EmptyState, StatusIndicator, ProviderLogo, LocalDatePipe, Card],
  templateUrl: './integrations-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationsListView {
  private readonly api = inject(IntegrationService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);
  readonly labels = inject(EnumLabelService);

  readonly stage = signal<Stage>('loading');
  readonly items = signal<Integration[]>([]);
  readonly query = signal('');
  // El filtro de estado es múltiple y filtra en pantalla: lista vacía = sin filtro.
  readonly statuses = signal<string[]>([]);
  readonly attentionOpen = signal(false);

  readonly isAdmin = computed(() => this.session.user()?.role === 'admin_empresa');
  readonly attention = computed(() => attentionItems(this.items()));
  readonly attentionCount = computed(() => this.attention().length);

  // Los estados del filtro y su orden salen del catálogo del backend (`integration_status`), no de una lista a mano.
  readonly statusOptions = signal<TableFilterOption[]>([]);

  readonly columns: TableColumn<Integration>[] = [
    { key: 'name', headerKey: 'INTEGRATIONS.LIST.COL_NAME', skeleton: 'person', class: 'lg:w-2/5 lg:min-w-72' },
    { key: 'purpose', headerKey: 'INTEGRATIONS.LIST.COL_PURPOSE', class: 'lg:w-1/5' },
    { key: 'resources', headerKey: 'INTEGRATIONS.LIST.COL_RESOURCES', align: 'center', class: 'lg:w-32' },
    { key: 'status', headerKey: 'INTEGRATIONS.LIST.COL_STATUS', skeleton: 'badge', class: 'lg:w-48' },
  ];
  readonly rowKey = (item: Integration): string => item.code;

  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const statuses = this.statuses();
    return this.items().filter((i) => (!q || i.name.toLowerCase().includes(q)) && (statuses.length === 0 || statuses.includes(i.status)));
  });

  readonly tone = integrationTone;
  readonly link = connectionLink;

  constructor() {
    // El idioma no cambia durante la sesión (cambiarlo recarga la app): se pide una sola vez.
    this.catalog.options('integration_status').subscribe({
      next: (options) => this.statusOptions.set(options.map((o) => ({ value: o.value, label: o.label }))),
      error: () => this.statusOptions.set([]),
    });
    this.load();
  }

  load(): void {
    const firstLoad = this.stage() !== 'ready';
    if (firstLoad) this.stage.set('loading');
    this.api.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.stage.set('ready');
      },
      error: () => {
        if (firstLoad) this.stage.set('error');
      },
    });
  }

  toggleAttention(): void {
    this.attentionOpen.update((v) => !v);
  }

  /** La fila abre el detalle de la integración (sus conexiones viven en la pestaña «Conexiones»). */
  open(item: Integration): void {
    void this.router.navigate(['/integraciones', item.code]);
  }
}
