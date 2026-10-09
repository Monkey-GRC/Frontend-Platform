import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, concatMap, from, map, of, toArray, forkJoin } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { apiErrorCode } from '@core/domain/utils/api-error';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ServiceListItem } from '../../../domain/models/service.models';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { ServiceService } from '../../../domain/services/service.service';

type Stage = 'loading' | 'error' | 'ready';

// "Mis servicios": una tabla para gestionarlos (como las listas de AWS): se seleccionan con la casilla de la izquierda y los botones de arriba
// actúan sobre lo seleccionado (ver, editar, eliminar uno o varios).
@Component({
  selector: 'app-services-list',
  imports: [RouterLink, LoadingSpinner],
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
  readonly query = signal('');
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly confirming = signal(false);
  readonly deleting = signal(false);
  readonly notice = signal<{ kind: 'error' | 'ok'; text: string } | null>(null);

  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.items().filter((i) => i.name.toLowerCase().includes(q) || this.typeLabel(i.type).toLowerCase().includes(q)) : this.items();
  });
  readonly selectedItems = computed(() => this.items().filter((i) => this.selected().has(i.id)));
  readonly count = computed(() => this.selected().size);
  readonly allSelected = computed(() => this.visible().length > 0 && this.visible().every((i) => this.selected().has(i.id)));
  readonly someSelected = computed(() => this.count() > 0 && !this.allSelected());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    forkJoin({
      page: this.services.list(),
      types: this.catalogService.options('service_type'),
      scenarios: this.catalogService.options('deployment_scenario'),
    }).subscribe({
      next: ({ page, types, scenarios }) => {
        this.items.set(page.items);
        this.types.set(types);
        this.scenarios.set(scenarios);
        this.selected.set(new Set());
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  scenarioLabel(value: string): string {
    return this.scenarios().find((s) => s.value === value)?.label ?? value;
  }

  typeLabel(value: string): string {
    return this.types().find((t) => t.value === value)?.label ?? value;
  }

  // ---- selección ----
  toggle(id: string): void {
    this.confirming.set(false);
    this.selected.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  toggleAll(): void {
    this.confirming.set(false);
    this.selected.set(this.allSelected() ? new Set() : new Set(this.visible().map((i) => i.id)));
  }

  // ---- acción sobre lo seleccionado: eliminar uno o varios (ver y editar se hacen desde el detalle del servicio) ----
  ask(): void {
    this.notice.set(null);
    this.confirming.set(this.count() > 0);
  }

  cancel(): void {
    this.confirming.set(false);
  }

  // Elimina uno por uno y cuenta lo que se pudo: un servicio con evaluaciones registradas no se elimina y no detiene a los demás.
  remove(): void {
    const targets = this.selectedItems();
    if (targets.length === 0) return;
    this.deleting.set(true);
    from(targets)
      .pipe(
        concatMap((item) =>
          this.services.remove(item.id).pipe(
            map(() => ({ item, error: null as unknown })),
            catchError((error) => of({ item, error })),
          ),
        ),
        toArray(),
      )
      .subscribe((results) => {
        this.deleting.set(false);
        this.confirming.set(false);
        const failed = results.filter((r) => r.error);
        const done = results.length - failed.length;
        const blocked = failed.filter((r) => apiErrorCode(r.error) === 'SERVICE_HAS_EVALUATIONS').map((r) => `«${r.item.name}»`);
        const parts: string[] = [];
        if (done > 0) parts.push(done === 1 ? 'Eliminamos 1 servicio.' : `Eliminamos ${done} servicios.`);
        if (blocked.length > 0) parts.push(`${blocked.join(', ')} ya tiene${blocked.length > 1 ? 'n' : ''} evaluaciones o evidencias registradas, por eso no se puede${blocked.length > 1 ? 'n' : ''} eliminar.`);
        const other = failed.length - blocked.length;
        if (other > 0) parts.push(`No pudimos eliminar ${other === 1 ? 'otro servicio' : `otros ${other}`}. Inténtalo de nuevo.`);
        this.notice.set({ kind: failed.length > 0 ? 'error' : 'ok', text: parts.join(' ') });
        this.items.update((list) => list.filter((i) => !results.some((r) => !r.error && r.item.id === i.id)));
        this.selected.set(new Set());
        // El siguiente paso del onboarding depende de que haya al menos un servicio.
        this.auth.validate().subscribe();
      });
  }
}
