import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { apiErrorCode, apiErrorMessage } from '@core/domain/utils/api-error';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ServiceListItem } from '../../../domain/models/service.models';
import { ServiceService } from '../../../domain/services/service.service';

type Stage = 'loading' | 'error' | 'ready';

// "Mis servicios": los servicios que la empresa declaró, con acceso a editarlos o declarar otro.
@Component({
  selector: 'app-services-list',
  imports: [RouterLink],
  templateUrl: './services-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesListView implements OnInit {
  private readonly services = inject(ServiceService);
  private readonly catalogService = inject(CatalogService);
  private readonly auth = inject(AuthService);
  readonly session = inject(SessionService);

  readonly stage = signal<Stage>('loading');
  readonly items = signal<ServiceListItem[]>([]);
  readonly types = signal<CatalogOption[]>([]);
  readonly scenarios = signal<CatalogOption[]>([]);
  // Servicio que se está por eliminar (confirmación en la propia tarjeta) y el aviso del resultado.
  readonly confirming = signal<string | null>(null);
  readonly deleting = signal<string | null>(null);
  readonly notice = signal<{ kind: 'error' | 'ok'; text: string } | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    forkJoin({ page: this.services.list(), types: this.catalogService.options('service_type'), scenarios: this.catalogService.options('deployment_scenario') }).subscribe({
      next: ({ page, types, scenarios }) => {
        this.items.set(page.items);
        this.types.set(types);
        this.scenarios.set(scenarios);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  // «Dónde vive» sale del catálogo del backend; la pantalla no fija la lista.
  scenarioLabel(value: string): string {
    return this.scenarios().find((s) => s.value === value)?.label ?? value;
  }

  typeLabel(value: string): string {
    return this.types().find((t) => t.value === value)?.label ?? value;
  }

  ask(id: string): void {
    this.notice.set(null);
    this.confirming.set(id);
  }

  cancel(): void {
    this.confirming.set(null);
  }

  remove(item: ServiceListItem): void {
    this.deleting.set(item.id);
    this.services.remove(item.id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.confirming.set(null);
        this.items.update((list) => list.filter((i) => i.id !== item.id));
        this.notice.set({ kind: 'ok', text: `Eliminamos «${item.name}».` });
        // El siguiente paso del onboarding depende de que haya al menos un servicio.
        this.auth.validate().subscribe();
      },
      error: (error) => {
        this.deleting.set(null);
        this.confirming.set(null);
        this.notice.set({
          kind: 'error',
          text:
            apiErrorCode(error) === 'SERVICE_HAS_EVALUATIONS'
              ? `«${item.name}» ya tiene evaluaciones o evidencias registradas, por eso no se puede eliminar.`
              : apiErrorMessage(error, 'No pudimos eliminar el servicio. Inténtalo de nuevo.'),
        });
      },
    });
  }
}
