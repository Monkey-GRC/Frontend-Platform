import { storedLanguage } from '@core/domain/services/language.service';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, forkJoin, of } from 'rxjs';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { Tag } from '@shared/presentation/components/tag/tag';
import { bindInsight } from '@features/compliance/domain/services/compliance-context.service';
import { ActiveComplianceService } from '@features/compliance/domain/services/active-compliance.service';
import { COMPLIANCE_ROUTE } from '@features/compliance/domain/models/compliance.models';
import { Cause, RiskDetail, RiskListItem } from '@shared/domain/models/risk.models';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { CauseDetailPanel } from '../../components/cause-detail-panel/cause-detail-panel';
import { RiskDetailPanel } from '../../components/risk-detail-panel/risk-detail-panel';
import { RiskForm } from '@shared/presentation/components/risk-form/risk-form';
import { RiskLevelBadge } from '@shared/presentation/components/risk-level-badge/risk-level-badge';
import { Stage } from '../../components/detail-panel-base/detail-panel-base';

type Section = 'risks' | 'causes';

const ALL = 'all';
// The group of what has no value in the grouping field (a v2 cause without type or category).
const UNCLASSIFIED = 'unclassified';

interface Group<T> {
  key: string;
  label: string;
  items: T[];
}

// Las pestañas «Riesgos» y «Causas» de un servicio (MD-124). Es la misma vista con dos rutas: `data.section` dice cuál es. Una causa no depende de un riesgo
// (10 de las 56 del catálogo no pertenecen a ninguno), así que tiene su propia pestaña. Un servicio trae unos 10 riesgos y 56 causas: se cargan completos y
// se agrupan aquí por los valores que llegan (criterio del riesgo, categoría de falla de la causa); el backend no sirve esas listas, no se escriben a mano.
// Un riesgo sin evaluar no es «bajo»: se muestra «Sin evaluar» hasta que exista la evaluación (MD-123).
@Component({
  selector: 'app-risks',
  imports: [TranslatePipe, OptionChips, DataTable, TableCell, TableToolbar, EmptyState, Tag, RiskLevelBadge, RiskDetailPanel, CauseDetailPanel, RiskForm],
  templateUrl: './risks.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RisksView {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(RiskService);
  readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  // El servicio activo lo elige el encabezado de Cumplimiento y se recuerda entre secciones (`ActiveComplianceService`).
  private readonly activeService = inject(ActiveComplianceService);
  readonly serviceId = computed(() => this.activeService.serviceId() ?? '');

  private readonly data = toSignal(this.route.data, { requireSync: true });
  readonly section = computed<Section>(() => (this.data()['section'] === 'causes' ? 'causes' : 'risks'));

  // `?abrir=<id>` abre el detalle de ese riesgo o causa (también al saltar de una pestaña a la otra) y `?tab=` su pestaña: se puede compartir y «Atrás» lo cierra.
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly tab = computed(() => this.queryParams().get('tab'));

  readonly stage = signal<Stage>('loading');
  readonly risks = signal<RiskListItem[]>([]);
  readonly causes = signal<Cause[]>([]);

  readonly selectedRisk = signal<string | null>(null);
  readonly selectedCause = signal<string | null>(null);

  readonly query = signal('');
  readonly group = signal<string | null>(null);

  /** El formulario abierto: uno nuevo (existing: null) o la edición de un riesgo o causa propios. Solo el administrador de la empresa. */
  readonly form = signal<{ existing: RiskDetail | Cause | null } | null>(null);

  private requestSeq = 0;

  // Riesgos: por criterio. Causas: por tipo de causa (clasificación v2, D129) si alguna lo trae; si no, por categoría de falla. Lo que no tiene valor va a
  // «Sin clasificar». Con un solo grupo la tabla no pinta filas de grupo (`data-table`) ni hay chips: el total ya está en el banner (MD-499).
  private readonly causeField = computed<'cause_type' | 'failure_category'>(() => (this.causes().some((c) => !!c.cause_type) ? 'cause_type' : 'failure_category'));
  private readonly groupPrefix = computed(() =>
    this.section() === 'risks' ? 'COMPLIANCE.RISK_CRITERION' : this.causeField() === 'cause_type' ? 'COMPLIANCE.CAUSE_TYPE' : 'COMPLIANCE.FAILURE_CATEGORY',
  );
  private readonly groupOf = (item: RiskListItem | Cause): string =>
    ('trust_criterion' in item ? item.trust_criterion : (this.causeField() === 'cause_type' ? item.cause_type : item.failure_category)) || UNCLASSIFIED;
  private readonly groupText = (key: string): string =>
    key === UNCLASSIFIED ? this.labels.of('COMPLIANCE.RISKS', 'UNCLASSIFIED') : this.labels.of(this.groupPrefix(), key);

  readonly current = computed<(RiskListItem | Cause)[]>(() => (this.section() === 'risks' ? this.risks() : this.causes()));

  /** Los grupos que existen en los datos, con su texto, ordenados por texto. */
  private readonly groupKeys = computed(() => {
    const keys = [...new Set(this.current().map((i) => this.groupOf(i)))];
    // «Sin clasificar» va al final.
    return keys.sort((a, b) => (a === UNCLASSIFIED ? 1 : b === UNCLASSIFIED ? -1 : this.groupText(a).localeCompare(this.groupText(b), storedLanguage())));
  });

  readonly chips = computed(() => [
    { value: ALL, label: this.labels.of('COMPLIANCE.RISKS', 'ALL') },
    ...this.groupKeys().map((k) => ({ value: k, label: this.groupText(k) })),
  ]);

  private readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const g = this.group();
    return this.current().filter((i) => (!g || this.groupOf(i) === g) && (!q || this.textOf(i).toLowerCase().includes(q) || i.code.toLowerCase().includes(q)));
  });

  readonly riskGroups = computed<Group<RiskListItem>[]>(() => this.grouped(this.filtered() as RiskListItem[]));
  readonly causeGroups = computed<Group<Cause>[]>(() => this.grouped(this.filtered() as Cause[]));
  readonly visibleCount = computed(() => this.filtered().length);
  /** Las filas de cada tabla: los grupos uno tras otro (por texto), con sus elementos por código; la tabla pone un encabezado de sección donde cambia el grupo. */
  readonly riskRows = computed(() => this.riskGroups().flatMap((g) => g.items));
  readonly causeRows = computed(() => this.causeGroups().flatMap((g) => g.items));

  protected readonly riskColumns: TableColumn<RiskListItem>[] = [
    { key: 'code', headerKey: 'COMPLIANCE.RISKS.COL_CODE', skeleton: 'badge' },
    { key: 'name', headerKey: 'COMPLIANCE.RISKS.COL_NAME', skeleton: 'lines' },
    { key: 'level', headerKey: 'COMPLIANCE.RISKS.COL_LEVEL', skeleton: 'badge' },
  ];
  protected readonly causeColumns: TableColumn<Cause>[] = [
    { key: 'code', headerKey: 'COMPLIANCE.RISKS.COL_CODE', skeleton: 'badge' },
    { key: 'name', headerKey: 'COMPLIANCE.RISKS.COL_NAME', skeleton: 'lines' },
  ];
  protected readonly byId = (item: RiskListItem | Cause): string => item.id;
  protected readonly rowLabel = (item: RiskListItem | Cause): string => `${item.code} ${this.textOf(item)}`;
  /** El nombre, o la descripción de una causa v2 que llega sin nombre. */
  private readonly textOf = (item: RiskListItem | Cause): string => item.name || ('description' in item ? item.description : '') || '';
  protected readonly groupKey = (item: RiskListItem | Cause): string => this.groupOf(item);
  // Se recalcula cuando cambia el campo del grupo (riesgos o causas, tipo o categoría), así la tabla vuelve a pedir los títulos.
  protected readonly groupLabel = computed(() => {
    const prefix = this.groupPrefix();
    return (key: string): string => (key === UNCLASSIFIED ? this.labels.of('COMPLIANCE.RISKS', 'UNCLASSIFIED') : this.labels.of(prefix, key));
  });
  protected readonly emptyTitleKey = computed(() =>
    this.hasFilters() ? 'COMPLIANCE.RISKS.EMPTY_FILTERED_TITLE' : this.section() === 'risks' ? 'COMPLIANCE.RISKS.EMPTY_RISKS_TITLE' : 'COMPLIANCE.RISKS.EMPTY_CAUSES_TITLE',
  );
  protected readonly emptyDescriptionKey = computed(() => (this.hasFilters() ? 'COMPLIANCE.RISKS.EMPTY_FILTERED_BODY' : 'COMPLIANCE.RISKS.EMPTY_BODY'));
  readonly hasFilters = computed(() => this.group() !== null || this.query().trim() !== '');

  constructor() {
    bindInsight(() =>
      this.stage() === 'ready' ? { kind: 'count', labelKey: this.section() === 'risks' ? 'COMPLIANCE.BANNER.RISKS' : 'COMPLIANCE.BANNER.CAUSES', count: this.current().length } : null,
    );
    effect(() => {
      this.serviceId();
      this.section();
      this.view.viewParam();
      untracked(() => this.load());
    });
    // El detalle abierto es el de la dirección: se abre, cambia o se cierra con ella.
    effect(() => {
      const id = this.queryParams().get('abrir');
      const risks = this.section() === 'risks';
      untracked(() => {
        this.selectedRisk.set(risks ? id : null);
        this.selectedCause.set(risks ? null : id);
      });
    });
  }

  load(): void {
    const seq = ++this.requestSeq;
    this.stage.set('loading');
    this.fetch().subscribe({
      next: ({ risks, causes }) => {
        if (seq !== this.requestSeq) return;
        this.risks.set(risks);
        this.causes.set(causes);
        this.stage.set('ready');
      },
      error: () => {
        if (seq !== this.requestSeq) return;
        this.stage.set('error');
      },
    });
  }

  /** Vuelve a pedir los datos sin parpadear: se usa cuando un drawer cambió algo (un vínculo, una baja). */
  refresh(): void {
    const seq = ++this.requestSeq;
    this.fetch().subscribe({
      next: ({ risks, causes }) => {
        if (seq !== this.requestSeq) return;
        this.risks.set(risks);
        this.causes.set(causes);
      },
    });
  }

  pickGroup(value: string): void {
    this.group.set(value === ALL || value === this.group() ? null : value);
  }

  clearFilters(): void {
    this.group.set(null);
    this.query.set('');
  }

  /** Abre un riesgo: aquí mismo si estamos en Riesgos, o saltando a esa pestaña si venimos de una causa. */
  openRisk(id: string): void {
    if (this.section() === 'risks') this.show(id);
    else this.jump('riesgos', id);
  }

  /** Abre una causa: aquí mismo si estamos en Causas, o saltando a esa pestaña si venimos de un riesgo. */
  openCause(id: string): void {
    if (this.section() === 'causes') this.show(id);
    else this.jump('causas', id);
  }

  /** Un control de la causa: se abre en Controles. */
  openControl(id: string): void {
    this.router.navigate(['/', COMPLIANCE_ROUTE, 'controles'], { queryParams: { abrir: id } });
  }

  newItem(): void {
    this.form.set({ existing: null });
  }

  editItem(existing: RiskDetail | Cause): void {
    this.form.set({ existing });
  }

  /** Se guardó: la lista se vuelve a pedir y el elemento se abre (uno nuevo, para vincularlo; uno editado, para ver el cambio). */
  onSaved(id: string): void {
    this.form.set(null);
    this.refresh();
    this.show(id);
  }

  closeDetail(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { abrir: null, tab: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  setTab(tab: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'summary' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private show(id: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { abrir: id, tab: null }, queryParamsHandling: 'merge' });
  }

  private jump(tab: 'riesgos' | 'causas', id: string): void {
    this.router.navigate(['/', COMPLIANCE_ROUTE, tab], { queryParams: { abrir: id } });
  }

  // Solo se pide lo que la pestaña muestra: riesgos en Riesgos, causas en Causas.
  private fetch(): Observable<{ risks: RiskListItem[]; causes: Cause[] }> {
    const view = this.view.viewParam();
    const id = this.serviceId();
    return forkJoin({
      risks: this.section() === 'risks' ? this.api.listAllRisks(id, view) : of([] as RiskListItem[]),
      causes: this.section() === 'causes' ? this.api.listAllCauses(id, view) : of([] as Cause[]),
    });
  }

  private grouped<T extends RiskListItem | Cause>(items: T[]): Group<T>[] {
    const by = new Map<string, T[]>();
    for (const i of items) {
      const k = this.groupOf(i);
      by.set(k, [...(by.get(k) ?? []), i]);
    }
    return [...by.entries()]
      .map(([key, list]) => ({ key, label: this.groupText(key), items: list.sort((a, b) => a.code.localeCompare(b.code, storedLanguage(), { numeric: true })) }))
      .sort((a, b) => (a.key === UNCLASSIFIED ? 1 : b.key === UNCLASSIFIED ? -1 : a.label.localeCompare(b.label, storedLanguage())));
  }
}
