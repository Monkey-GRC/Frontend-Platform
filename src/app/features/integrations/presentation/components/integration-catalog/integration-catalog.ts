import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { CatalogIntegration } from '@features/integrations/domain/models/integration.models';
import { IntegrationService } from '@features/integrations/domain/services/integration.service';
import { IntegrationCard } from '../integration-card/integration-card';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type Stage = 'loading' | 'error' | 'ready';

// El catálogo de integraciones, UNO solo: lo que manda el backend (`GET /v1/integrations/catalog`), por propósito (las secciones y su orden salen del catálogo `integration_purpose`), con buscador.
// Lo usan «Agregar integración» y las conexiones de un servicio, para que se vean y se comporten igual. Con `serviceId` las tarjetas abren el detalle de la integración «dentro» de ese servicio.
// Conectar no hace nada aquí: avisa con `connect` y quien lo usa decide (pedir el servicio, o seguir con el que ya tiene).
@Component({
  selector: 'app-integration-catalog',
  imports: [TranslatePipe, TableToolbar, EmptyState, IntegrationCard, Skeleton, SkeletonRegion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (stage()) {
      @case ('loading') {
        <app-skeleton-region data-catalog-loading>
          <div class="space-y-4"><app-skeleton shape="title" width="20%" /><div class="grid grid-cols-1 gap-4 lg:grid-cols-3"><app-skeleton shape="card" /><app-skeleton shape="card" /><app-skeleton shape="card" /></div></div>
        </app-skeleton-region>
      }
      @case ('error') {
        <app-empty-state icon="" titleKey="INTEGRATIONS.ADD.LOAD_ERROR_TITLE" descriptionKey="COMMON.CHECK_CONNECTION">
          <button action type="button" (click)="load()" class="mk-btn">{{ 'COMMON.RETRY' | translate }}</button>
        </app-empty-state>
      }
      @default {
        <app-table-toolbar searchPlaceholderKey="INTEGRATIONS.ADD.SEARCH_PLACEHOLDER" [query]="query()" (queryChange)="query.set($event)" />

        @if (sections().length === 0) {
          <app-empty-state icon="" [titleKey]="query() ? 'INTEGRATIONS.ADD.NO_MATCH' : 'INTEGRATIONS.ADD.EMPTY_TITLE'" />
        } @else {
          <div class="space-y-6">
            @for (s of sections(); track s.purpose) {
              <section [attr.aria-labelledby]="'purpose-' + s.purpose" [attr.data-purpose]="s.purpose">
                <h2 [id]="'purpose-' + s.purpose" class="text-lg font-semibold text-ink">{{ s.title }}</h2>
                <p class="mt-1 text-sm text-ink-muted">{{ 'INTEGRATIONS.ADD.PURPOSE_HINT_' + s.purpose.toUpperCase() | translate }}</p>
                <ul class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  @for (i of s.items; track i.code) {
                    <li><app-integration-card [item]="i" [serviceId]="serviceId()" (connect)="connect.emit($event)" /></li>
                  }
                </ul>
              </section>
            }
          </div>
        }
      }
    }
  `,
})
export class IntegrationCatalog {
  private readonly api = inject(IntegrationService);
  private readonly catalog = inject(CatalogService);

  /** El servicio desde el que se llegó (las conexiones de un servicio); `null` desde «Integraciones». */
  readonly serviceId = input<string | null>(null);
  readonly connect = output<CatalogIntegration>();

  readonly stage = signal<Stage>('loading');
  readonly items = signal<CatalogIntegration[]>([]);
  readonly purposes = signal<CatalogOption[]>([]);
  readonly query = signal('');

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
}
