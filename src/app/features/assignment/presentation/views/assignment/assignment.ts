import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { apiErrorCode, apiErrorMessage } from '@core/domain/utils/api-error';
import { PageInfo } from '@shared/domain/models/page-info.model';
import { ServiceListItem } from '@shared/domain/models/service.models';
import { TeamMember } from '@shared/domain/models/team.models';
import { controlLink } from '@shared/domain/models/route-links';
import { ServiceService } from '@shared/domain/services/service.service';
import { TeamService } from '@shared/domain/services/team.service';
import { isCompanyAdmin } from '@shared/domain/utils/roles';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { PersonCell } from '@shared/presentation/components/person-cell/person-cell';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { TableFilter } from '@shared/presentation/components/table-filter/table-filter';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { Tag } from '@shared/presentation/components/tag/tag';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { AssignmentFilter, AssignmentItem, CONTROL_STATES, ControlState, MAX_BATCH } from '@features/assignment/domain/models/assignment.models';
import { AssignmentService } from '@features/assignment/domain/services/assignment.service';
import { AssignmentQueryState, assignmentQueryParams, hasActiveFilters, parseAssignmentQuery } from '@features/assignment/domain/utils/assignment-query';
import { assignmentErrorKey } from '@features/assignment/domain/utils/assignment-errors';
import { DelegationScope, delegationScope, ownerCandidates, personName, teamDelegates, vigentDelegates } from '@features/assignment/domain/utils/assignment-people';
import { AssignmentDelegateForm } from '../../components/assignment-delegate-form/assignment-delegate-form';
import { AssignmentOwnerForm } from '../../components/assignment-owner-form/assignment-owner-form';

type Stage = 'loading' | 'error' | 'ready';

const PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 300;
const ALL = 'all';

// Los tonos del estado del control (`control_state`): colour never travels alone, el texto va en el indicador.
const STATE_TONES: Record<ControlState, StatusTone> = {
  effective: 'ok',
  ineffective: 'bad',
  expired: 'bad',
  error: 'bad',
  incomplete: 'warn',
  evaluating: 'info',
  no_tests: 'neutral',
};

// Asignación (D150, MD-192, MD-503): quién es el dueño de cada control y quién lo ejecuta. Un servicio a la vez; la lista es del servidor (filtros, búsqueda y páginas) y el servicio y los
// filtros viven en la dirección (`?servicio=<id>&asignacion=unassigned`), así un aviso o un enlace llega ya filtrado. El administrador asigna el dueño y también delega; el responsable delega
// solo en sus controles y entre los delegados de su equipo. La selección es en lote (hasta 200) y se conserva al cambiar de página. Al asignar, el servidor avisa a la persona (`control_assigned`).
@Component({
  selector: 'app-assignment',
  imports: [
    RouterLink, TranslatePipe, DataTable, TableCell, EmptyState, OptionChips, PageHeader, PersonCell, Select, Skeleton, SkeletonRegion, StatusIndicator, TableFilter, TableToolbar, Tag,
    AssignmentOwnerForm, AssignmentDelegateForm,
  ],
  templateUrl: './assignment.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentView {
  private readonly api = inject(AssignmentService);
  private readonly serviceApi = inject(ServiceService);
  private readonly teamApi = inject(TeamService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly personName = personName;
  protected readonly controlLink = controlLink;
  protected readonly stateTone = (state: ControlState): StatusTone => STATE_TONES[state] ?? 'neutral';

  readonly meId = computed(() => this.session.user()?.id ?? null);
  /** El administrador asigna el dueño y delega; el responsable solo delega (la ruta ya deja entrar solo a los dos). */
  readonly isAdmin = computed(() => isCompanyAdmin(this.session.user()?.role));

  // Los servicios (el selector) y el equipo (los candidatos de los formularios y de los filtros).
  readonly servicesStage = signal<Stage>('loading');
  readonly serviceList = signal<ServiceListItem[]>([]);
  readonly membersStage = signal<Stage>('loading');
  private readonly members = signal<TeamMember[]>([]);

  // Lo que dice la dirección: el servicio y los filtros. Sin servicio (o con uno que no es de la empresa) vale el primero.
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly view = computed<AssignmentQueryState>(() => parseAssignmentQuery(this.query()));
  readonly serviceId = computed<string | null>(() => {
    const wanted = this.view().serviceId;
    const list = this.serviceList();
    return list.find((s) => s.id === wanted)?.id ?? list[0]?.id ?? null;
  });
  // Lo que decide si hay que volver a pedir la lista: el servicio efectivo y los filtros. Es un texto, así que poner el servicio en la dirección (que ya era el efectivo) no la pide dos veces.
  private readonly requestKey = computed(() => {
    const v = this.view();
    return JSON.stringify([this.serviceId(), v.assignment, v.ownerId, v.executorId, v.status, v.q]);
  });
  readonly hasFilters = computed(() => hasActiveFilters(this.view()));
  readonly searchText = signal(this.view().q);
  private lastSentQuery = this.view().q;
  private readonly searches = new Subject<string>();

  // La lista de controles.
  readonly stage = signal<Stage>('loading');
  readonly rows = signal<AssignmentItem[]>([]);
  readonly pageInfo = signal<PageInfo | null>(null);
  readonly loadingPage = signal(false);
  private readonly pageNumber = signal(1);
  private readonly pageSize = signal(PAGE_SIZE);
  private readonly loads = new Subject<void>();

  // La selección en lote: se guardan las filas (no solo los ids) para saber de quién son al delegar, aunque estén en otra página.
  private readonly selectedRows = signal<ReadonlyMap<string, AssignmentItem>>(new Map());
  readonly selectedIds = computed<ReadonlySet<string>>(() => new Set(this.selectedRows().keys()));
  readonly selectedList = computed(() => [...this.selectedRows().values()]);
  readonly selectedCount = computed(() => this.selectedRows().size);
  readonly limitReached = signal(false);

  // Los formularios.
  readonly ownerOpen = signal(false);
  readonly delegateOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly serviceOptions = computed<SelectOption[]>(() => this.serviceList().map((s) => ({ value: s.id, label: s.name })));
  readonly ownerChoices = computed(() => ownerCandidates(this.members(), this.meId()));
  readonly ownerFilterOptions = computed(() => this.ownerChoices().map((m) => ({ value: m.id, label: personName(m, m.email) })));
  readonly executorFilterOptions = computed(() => vigentDelegates(this.members()).map((m) => ({ value: m.id, label: personName(m, m.email) })));
  readonly stateFilterOptions = CONTROL_STATES.map((value) => ({ value, labelKey: `ASSIGNMENT.STATE.${value.toUpperCase()}` }));
  readonly delegationScope = computed<DelegationScope>(() => delegationScope(this.selectedList(), this.translate.instant('ASSIGNMENT.PERSON.UNKNOWN')));
  readonly delegates = computed(() => {
    const scope = this.delegationScope();
    if (scope.kind !== 'team') return [];
    return this.isAdmin() ? teamDelegates(this.members(), scope.ownerId) : vigentDelegates(this.members());
  });

  private readonly chipLabels = toSignal(this.translate.stream(['ASSIGNMENT.FILTER.ALL', 'ASSIGNMENT.FILTER.UNASSIGNED', 'ASSIGNMENT.FILTER.ASSIGNED']), {
    initialValue: {} as Record<string, string>,
  });
  readonly assignmentChips = computed(() => [
    { value: ALL, label: this.chipLabels()['ASSIGNMENT.FILTER.ALL'] ?? '' },
    { value: 'unassigned', label: this.chipLabels()['ASSIGNMENT.FILTER.UNASSIGNED'] ?? '' },
    { value: 'assigned', label: this.chipLabels()['ASSIGNMENT.FILTER.ASSIGNED'] ?? '' },
  ]);

  readonly columns = computed<TableColumn<AssignmentItem>[]>(() => [
    { key: 'code', headerKey: 'ASSIGNMENT.TABLE.CODE', skeleton: 'badges' },
    { key: 'name', headerKey: 'ASSIGNMENT.TABLE.NAME', skeleton: 'lines' },
    { key: 'owner', headerKey: 'ASSIGNMENT.TABLE.OWNER', skeleton: 'person' },
    { key: 'executor', headerKey: 'ASSIGNMENT.TABLE.EXECUTOR', skeleton: 'person' },
    { key: 'state', headerKey: 'ASSIGNMENT.TABLE.STATE', skeleton: 'badge' },
  ]);
  readonly rowKey = (row: AssignmentItem): string => row.client_control_id;
  readonly rowLabel = (row: AssignmentItem): string => `${row.code} ${row.name}`;

  /** Qué dice la tabla cuando no hay filas: con todo asignado (filtro «Sin asignar» y nada más), es una buena noticia, no un vacío. */
  readonly emptyKeys = computed(() => {
    const v = this.view();
    if (v.assignment === 'unassigned' && v.ownerId === null && v.executorId === null && v.status === null && v.q === '') return { title: 'ASSIGNMENT.EMPTY.ALL_ASSIGNED_TITLE', body: 'ASSIGNMENT.EMPTY.ALL_ASSIGNED_BODY' };
    if (this.hasFilters()) return { title: 'ASSIGNMENT.EMPTY.FILTERED_TITLE', body: 'ASSIGNMENT.EMPTY.FILTERED_BODY' };
    return this.isAdmin() ? { title: 'ASSIGNMENT.EMPTY.NONE_ADMIN_TITLE', body: 'ASSIGNMENT.EMPTY.NONE_ADMIN_BODY' } : { title: 'ASSIGNMENT.EMPTY.NONE_OWNER_TITLE', body: 'ASSIGNMENT.EMPTY.NONE_OWNER_BODY' };
  });

  constructor() {
    this.loadServices();
    this.loadMembers();

    this.loads
      .pipe(
        switchMap(() => {
          const serviceId = this.serviceId();
          const v = this.view();
          return this.api
            .list({ serviceId, assignment: v.assignment, ownerId: v.ownerId, executorId: v.executorId, status: v.status, q: v.q, page: this.pageNumber(), pageSize: this.pageSize() })
            .pipe(
              map((page) => ({ page })),
              catchError(() => of({ page: null })),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ page }) => {
        this.loadingPage.set(false);
        if (!page) {
          this.stage.set('error');
          return;
        }
        this.rows.set(page.items);
        this.pageInfo.set(page.page);
        this.stage.set('ready');
        this.refreshSelection(page.items);
      });

    // El buscador va al servidor, pero no con cada tecla: se espera un momento y el texto pasa a la dirección.
    this.searches.pipe(debounceTime(SEARCH_DELAY_MS), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      this.lastSentQuery = q.trim();
      this.restart({ q });
    });

    // Sin servicio en la dirección (o con uno ajeno), se deja el primero a la vista para que el enlace sea el real.
    effect(() => {
      const current = this.serviceId();
      const wanted = this.view().serviceId;
      const ready = this.servicesStage() === 'ready';
      untracked(() => {
        if (ready && current && wanted !== current) this.navigate({ serviceId: current }, true);
      });
    });

    // Cambia el servicio o un filtro de la dirección: se vuelve a pedir la lista (a la primera página, que ya se fijó donde se cambió).
    effect(() => {
      this.requestKey();
      const serviceId = this.serviceId();
      untracked(() => {
        if (serviceId) this.load();
      });
    });

    // Atrás o adelante del navegador cambian el texto de la dirección: el buscador lo sigue (salvo lo que se está escribiendo).
    effect(() => {
      const q = this.view().q;
      untracked(() => {
        if (q !== this.lastSentQuery) {
          this.lastSentQuery = q;
          this.searchText.set(q);
        }
      });
    });
  }

  loadServices(): void {
    this.servicesStage.set('loading');
    this.serviceApi.list(1, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.serviceList.set(page.items);
        this.servicesStage.set('ready');
      },
      error: () => this.servicesStage.set('error'),
    });
  }

  loadMembers(): void {
    this.membersStage.set('loading');
    this.teamApi.listAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (members) => {
        this.members.set(members);
        this.membersStage.set('ready');
      },
      error: () => this.membersStage.set('error'),
    });
  }

  load(): void {
    if (this.stage() !== 'ready') this.stage.set('loading');
    else this.loadingPage.set(true);
    this.loads.next();
  }

  // Filtros y búsqueda: se escriben en la dirección (la lista se vuelve a pedir sola) y se vuelve a la primera página.
  setService(id: string): void {
    this.clearSelection();
    this.restart({ serviceId: id, assignment: null, ownerId: null, executorId: null, status: null, q: '' });
    this.searchText.set('');
  }

  pickAssignment(value: string): void {
    this.restart({ assignment: value === ALL ? null : (value as AssignmentFilter) });
  }

  pickOwner(value: string): void {
    this.restart({ ownerId: value || null });
  }

  pickExecutor(value: string): void {
    this.restart({ executorId: value || null });
  }

  pickState(value: string): void {
    this.restart({ status: (value || null) as ControlState | null });
  }

  onSearch(text: string): void {
    this.searchText.set(text);
    this.searches.next(text);
  }

  clearFilters(): void {
    this.searchText.set('');
    this.lastSentQuery = '';
    this.restart({ assignment: null, ownerId: null, executorId: null, status: null, q: '' });
  }

  goTo(page: number): void {
    this.pageNumber.set(page);
    this.load();
  }

  resize(size: number): void {
    this.pageSize.set(size);
    this.pageNumber.set(1);
    this.load();
  }

  // La selección (casillas de la tabla): se conserva entre páginas y se detiene en el máximo de una asignación masiva.
  onSelection(ids: Set<string | number>): void {
    const pageRows = new Map(this.rows().map((r) => [r.client_control_id, r]));
    const current = this.selectedRows();
    const next = new Map<string, AssignmentItem>();
    for (const id of ids) {
      const row = pageRows.get(String(id)) ?? current.get(String(id));
      if (row) next.set(row.client_control_id, row);
    }
    if (next.size > MAX_BATCH) {
      this.limitReached.set(true);
      return;
    }
    this.limitReached.set(false);
    this.selectedRows.set(next);
  }

  clearSelection(): void {
    this.selectedRows.set(new Map());
    this.limitReached.set(false);
  }

  openOwner(): void {
    this.formError.set(null);
    this.ownerOpen.set(true);
  }

  openDelegate(): void {
    this.formError.set(null);
    this.delegateOpen.set(true);
  }

  closeForms(): void {
    if (this.saving()) return;
    this.ownerOpen.set(false);
    this.delegateOpen.set(false);
    this.formError.set(null);
  }

  submitOwner(ownerId: string | null): void {
    this.submit(this.api.setOwner(this.selectedList().map((r) => r.client_control_id), ownerId), ownerId === null ? 'OWNER_CLEARED' : 'OWNER_SET');
  }

  submitDelegate(executorId: string | null): void {
    this.submit(this.api.setExecutor(this.selectedList().map((r) => r.client_control_id), executorId), executorId === null ? 'DELEGATE_REMOVED' : 'DELEGATE_SET');
  }

  /** Los textos con número van en dos claves (`_ONE` y `_MANY`): ngx-translate no trae plurales. */
  countKey(base: string, count: number): string {
    return `${base}_${count === 1 ? 'ONE' : 'MANY'}`;
  }

  private submit(request: ReturnType<AssignmentService['setOwner']>, outcome: 'OWNER_SET' | 'OWNER_CLEARED' | 'DELEGATE_SET' | 'DELEGATE_REMOVED'): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set(null);
    request.subscribe({
      next: ({ updated }) => {
        this.saving.set(false);
        this.ownerOpen.set(false);
        this.delegateOpen.set(false);
        this.clearSelection();
        if (updated === 0) this.toast.showInfo(this.translate.instant('ASSIGNMENT.TOAST.NOTHING_CHANGED'), this.translate.instant('ASSIGNMENT.TOAST.NOTHING_CHANGED_BODY'));
        else this.toast.showSuccess(this.translate.instant(this.countKey(`ASSIGNMENT.TOAST.${outcome}`, updated), { count: updated }), this.translate.instant(`ASSIGNMENT.TOAST.${outcome}_BODY`));
        this.load();
      },
      error: (e: unknown) => {
        this.saving.set(false);
        const key = assignmentErrorKey(e);
        this.formError.set(key ? this.translate.instant(key) : apiErrorMessage(e, this.translate.instant('ASSIGNMENT.ERROR.GENERIC')));
        // Lo que se eligió ya cambió (un control se dio de baja o dejó de ser de quien asigna): se refresca la lista para que se vea lo real.
        const code = apiErrorCode(e);
        if (code === 'CONTROL_RETIRED' || code === 'EXECUTOR_NOT_IN_TEAM' || code === 'OWNER_NOT_ELIGIBLE') this.loadMembers();
        if (code === 'CONTROL_RETIRED') this.load();
      },
    });
  }

  // Lo seleccionado se actualiza con lo que trae la página nueva (el dueño pudo cambiar), sin perder lo de otras páginas.
  private refreshSelection(items: AssignmentItem[]): void {
    const current = this.selectedRows();
    if (current.size === 0) return;
    const fresh = new Map(items.map((r) => [r.client_control_id, r]));
    this.selectedRows.set(new Map([...current].map(([id, row]) => [id, fresh.get(id) ?? row])));
  }

  private restart(change: Partial<AssignmentQueryState>): void {
    this.pageNumber.set(1);
    this.navigate(change, false);
  }

  private navigate(change: Partial<AssignmentQueryState>, replaceUrl: boolean): void {
    const next: AssignmentQueryState = { ...this.view(), ...change };
    void this.router.navigate([], { relativeTo: this.route, queryParams: assignmentQueryParams(next), queryParamsHandling: 'merge', replaceUrl });
  }
}
