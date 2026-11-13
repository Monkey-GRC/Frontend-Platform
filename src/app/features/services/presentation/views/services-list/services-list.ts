import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { catchError, concatMap, from, map, of, toArray, forkJoin } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { apiErrorCode } from '@core/domain/utils/api-error';
import { AuthService } from '@core/domain/services/auth.service';
import { CatalogOption, FrameworkOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ServiceListItem } from '@shared/domain/models/service.models';
import { ServiceService } from '@shared/domain/services/service.service';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';
import { Badge } from '@shared/presentation/components/badge/badge';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';

type Stage = 'loading' | 'error' | 'ready';

// "Mis servicios": una tabla para gestionarlos (como las listas de AWS): se seleccionan con la casilla de la izquierda y los botones de arriba
// actúan sobre lo seleccionado (ver, editar, eliminar uno o varios).
@Component({
  selector: 'app-services-list',
  imports: [Badge, PageHeader, RouterLink, TranslatePipe, DataTable, TableCell, TableToolbar, EmptyState, StatusIndicator, Tag, Busy, BusyFields],
  templateUrl: './services-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesListView implements OnInit {
  private readonly services = inject(ServiceService);
  private readonly catalogService = inject(CatalogService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly session = inject(SessionService);

  readonly stage = signal<Stage>('loading');
  readonly items = signal<ServiceListItem[]>([]);
  // Cuántos servicios tiene la empresa en total (lo que dice el backend), no solo los de la página que se ve.
  readonly total = signal(0);
  readonly types = signal<CatalogOption[]>([]);
  // El nombre de los marcos sale del catálogo del backend (el servicio solo trae el código); sin él se muestra el código.
  private readonly frameworks = signal<FrameworkOption[]>([]);
  readonly query = signal('');
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly confirming = signal(false);
  readonly deleting = signal(false);
  readonly notice = signal<{ kind: 'error' | 'ok'; text: string } | null>(null);

  readonly columns: TableColumn<ServiceListItem>[] = [
    { key: 'name', headerKey: 'SERVICES.LIST.COL_NAME' },
    { key: 'type', headerKey: 'SERVICES.LIST.COL_TYPE', skeleton: 'badge' },
    { key: 'frameworks', headerKey: 'SERVICES.LIST.COL_FRAMEWORKS', skeleton: 'badge' },
    { key: 'connections', headerKey: 'SERVICES.LIST.COL_CONNECTIONS', skeleton: 'badge' },
    { key: 'catalog', headerKey: 'SERVICES.LIST.COL_CATALOG', skeleton: 'badge' },
    { key: 'actions', headerKey: 'SERVICES.LIST.COL_ACTIONS', align: 'right', srOnlyHeader: true, skeleton: 'actions' },
  ];
  readonly rowKey = (item: ServiceListItem): string => item.id;
  readonly rowName = (item: ServiceListItem): string => item.name;

  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.items().filter((i) => i.name.toLowerCase().includes(q) || this.typeLabel(i.type).toLowerCase().includes(q)) : this.items();
  });
  readonly selectedItems = computed(() => this.items().filter((i) => this.selected().has(i.id)));
  readonly count = computed(() => this.selected().size);

  confirmMessage(): string {
    const items = this.selectedItems();
    return items.length === 1
      ? this.translate.instant('SERVICES.LIST.CONFIRM_ONE', { name: items[0].name })
      : this.translate.instant('SERVICES.LIST.CONFIRM_MANY', { count: items.length });
  }

  constructor() {
    // El backend traduce los catálogos: al cambiar el idioma se vuelven a pedir, sin recrear la pantalla ni perder la selección.
    effect(() => {
      this.language.current();
      untracked(() => {
        if (this.stage() !== 'ready') return;
        this.catalogService.options('service_type').subscribe((t) => this.types.set(t));
        this.loadFrameworks();
      });
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    forkJoin({
      page: this.services.list(),
      types: this.catalogService.options('service_type'),
      frameworks: this.catalogService.frameworks().pipe(catchError(() => of([] as FrameworkOption[]))),
    }).subscribe({
      next: ({ page, types, frameworks }) => {
        this.frameworks.set(frameworks);
        this.items.set(page.items);
        this.total.set(page.total);
        this.types.set(types);
        this.selected.set(new Set());
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  private loadFrameworks(): void {
    this.catalogService.frameworks().pipe(catchError(() => of([] as FrameworkOption[]))).subscribe((f) => this.frameworks.set(f));
  }

  frameworkLabel(code: string): string {
    return this.frameworks().find((f) => f.code === code)?.label ?? code;
  }

  typeLabel(value: string): string {
    return this.types().find((t) => t.value === value)?.label ?? value;
  }

  // ---- selección ----
  /** La tabla guarda las casillas de las filas que se ven; la selección es de esta vista. */
  select(keys: ReadonlySet<string | number>): void {
    this.confirming.set(false);
    this.selected.set(new Set([...keys].map(String)));
  }

  // ---- acción sobre lo seleccionado: eliminar uno o varios (ver y editar se hacen desde el detalle del servicio) ----
  ask(): void {
    this.notice.set(null);
    this.confirming.set(this.count() > 0);
  }

  // Acción de fila: elimina solo ese servicio (la selección pasa a ser ese).
  askOne(item: ServiceListItem): void {
    this.selected.set(new Set([item.id]));
    this.ask();
  }

  clearSelection(): void {
    this.confirming.set(false);
    this.selected.set(new Set());
  }

  cancel(): void {
    this.confirming.set(false);
  }

  // Elimina uno por uno y cuenta lo que se pudo: un servicio con evaluaciones registradas no se elimina y no detiene a los demás.
  remove(): void {
    if (this.deleting()) return;
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
        if (done > 0) parts.push(this.translate.instant(done === 1 ? 'SERVICES.LIST.DELETED_ONE' : 'SERVICES.LIST.DELETED_MANY', { count: done }));
        if (blocked.length > 0) parts.push(this.translate.instant(blocked.length > 1 ? 'SERVICES.LIST.BLOCKED_MANY' : 'SERVICES.LIST.BLOCKED_ONE', { names: blocked.join(', ') }));
        const other = failed.length - blocked.length;
        if (other > 0) parts.push(this.translate.instant(other === 1 ? 'SERVICES.LIST.FAILED_ONE' : 'SERVICES.LIST.FAILED_MANY', { count: other }));
        this.notice.set({ kind: failed.length > 0 ? 'error' : 'ok', text: parts.join(' ') });
        this.items.update((list) => list.filter((i) => !results.some((r) => !r.error && r.item.id === i.id)));
        this.total.update((t) => Math.max(0, t - done));
        this.selected.set(new Set());
        // El siguiente paso del onboarding depende de que haya al menos un servicio.
        this.auth.validate().subscribe();
      });
  }
}
