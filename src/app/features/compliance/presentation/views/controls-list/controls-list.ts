import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, DestroyRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { READINESS_LEVELS, Readiness } from '@shared/domain/models/readiness.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { PageInfo } from '@shared/domain/models/page-info.model';
import { formatPercent, percentOf } from '@shared/domain/utils/percentage';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { readinessLook } from '@shared/domain/utils/readiness-look';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { levelTone } from '@features/compliance/domain/utils/control-v2-look';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';
import { Badge } from '@shared/presentation/components/badge/badge';
import { bindInsight } from '@features/compliance/domain/services/compliance-context.service';
import { ActiveComplianceService } from '@features/compliance/domain/services/active-compliance.service';
import { ControlListItem, TrustCriterion } from '@features/compliance/domain/models/control.models';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { ActivatedRoute, Router } from '@angular/router';
import { COMPLIANCE_ROUTE } from '@features/compliance/domain/models/compliance.models';
import { ControlDetailPanel } from '../../components/control-detail-panel/control-detail-panel';

type Stage = 'loading' | 'error' | 'ready';

const ALL = 'all';
const PAGE_SIZE = 25;

// La pestaña «Controles» de un servicio (MD-120). Las categorías (los criterios de confianza de SOC 2) agrupan la lista: elegir una vuelve a
// pedir al backend con ese filtro, así la paginación sigue siendo la del servidor. Cada control muestra, a la vez, su estado cualitativo, su
// porcentaje de cumplimiento y su cobertura, con los conteos entre paréntesis (D80); nunca un porcentaje solo. «Sin medir» no es un fallo.
@Component({
  selector: 'app-controls-list',
  imports: [Badge, Tag, TranslatePipe, DataTable, TableCell, TableToolbar, OptionChips, StatusIndicator, EmptyState, ControlDetailPanel],
  templateUrl: './controls-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlsListView {
  protected readonly readinessLook = readinessLook;
  protected readonly levelTone = levelTone;
  protected readonly labels = inject(EnumLabelService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly view = inject(ComplianceViewService);

  // El servicio activo lo elige el encabezado de Cumplimiento y se recuerda entre secciones (`ActiveComplianceService`).
  private readonly activeService = inject(ActiveComplianceService);
  readonly serviceId = computed(() => this.activeService.serviceId() ?? '');

  // El control abierto y su pestaña van en la dirección (`?abrir=<id>&tab=`): se puede compartir y «Atrás» lo cierra.
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly selected = computed(() => this.query().get('abrir'));
  readonly tab = computed(() => this.query().get('tab'));

  readonly stage = signal<Stage>('loading');
  readonly rows = signal<ControlListItem[]>([]);
  readonly page = signal<PageInfo | null>(null);
  readonly loadingPage = signal(false);

  readonly trust = signal<TrustCriterion | null>(null);
  readonly readiness = signal<Readiness | null>(null);
  private readonly pageNumber = signal(1);
  private readonly pageSize = signal(PAGE_SIZE);

  // Los temas salen del catálogo del backend (traducidos según el idioma de la sesión); aquí no hay listas escritas a mano.
  private readonly trustOptions = signal<CatalogOption[]>([]);

  // Una petición más nueva descarta la respuesta de una anterior (cambios rápidos de filtro o de página).
  private requestSeq = 0;

  readonly topicChips = computed(() => [
    { value: ALL, label: this.t('COMPLIANCE.CONTROLS.ALL_TOPICS') },
    ...this.trustOptions().map((o) => ({ value: o.value, label: o.label })),
  ]);

  // Los estados salen del enum del backend (`readiness`) y su texto del glosario ya aprobado (`COMMON.READINESS`).
  readonly readinessChips = computed(() => [
    { value: ALL, label: this.t('COMPLIANCE.CONTROLS.ALL_STATUSES') },
    ...READINESS_LEVELS.map((level) => ({ value: level, label: this.t(`COMMON.READINESS.LABEL.${level.toUpperCase()}`) })),
  ]);

  readonly columns = computed<TableColumn<ControlListItem>[]>(() => [
    { key: 'code', headerKey: 'COMPLIANCE.CONTROLS.COLUMN_TECHNICAL', skeleton: 'badges' },
    { key: 'name', headerKey: 'COMPLIANCE.CONTROLS.COLUMN_NAME', skeleton: 'lines' },
    { key: 'topics', headerKey: 'COMPLIANCE.CONTROLS.COLUMN_TOPIC', skeleton: 'badge' },
    { key: 'status', headerKey: 'COMPLIANCE.CONTROLS.COLUMN_STATUS', skeleton: 'badges' },
    { key: 'counts', headerKey: 'COMPLIANCE.CONTROLS.COLUMN_PROGRESS', skeleton: 'progress' },
  ]);

  readonly percentOf = percentOf;

  /** «60 %» (o «—» sin total), en el idioma de la sesión. */
  pct(part: number, total: number): string {
    return formatPercent(percentOf(part, total), this.language.current());
  }

  readonly rowKey = (row: ControlListItem): string => row.id;
  readonly hasFilters = computed(() => this.trust() !== null || this.readiness() !== null);

  private readonly translationsTick = signal(0);

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Con un filtro puesto el total es el del filtro, no el de los controles del servicio: no se publica.
    bindInsight(() => {
      const total = this.page()?.total;
      return this.stage() === 'ready' && !this.hasFilters() && total !== undefined ? { kind: 'count', labelKey: 'COMPLIANCE.BANNER.CONTROLS', count: total } : null;
    });
    merge(this.translate.onLangChange, this.translate.onTranslationChange)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.translationsTick.update((n) => n + 1));
    // El backend traduce los catálogos: al cambiar el idioma se vuelven a pedir, sin recrear la pantalla ni perder los filtros.
    effect(() => {
      this.language.current();
      untracked(() => this.catalogs.options('trust_criterion').pipe(takeUntilDestroyed(this.destroyRef)).subscribe((options) => this.trustOptions.set(options)));
    });
    // Mientras haya un servicio y un tipo de vista, se carga; cambiar de servicio recarga.
    effect(() => {
      this.serviceId();
      this.view.viewParam();
      untracked(() => this.load());
    });
  }

  load(): void {
    const seq = ++this.requestSeq;
    const firstLoad = this.stage() !== 'ready';
    if (firstLoad) this.stage.set('loading');
    else this.loadingPage.set(true);

    this.api
      .list(this.serviceId(), { page: this.pageNumber(), pageSize: this.pageSize(), trustCriterion: this.trust(), readiness: this.readiness() }, this.view.viewParam())
      .subscribe({
        next: ({ items, page }) => {
          if (seq !== this.requestSeq) return;
          this.rows.set(items);
          this.page.set(page);
          this.loadingPage.set(false);
          this.stage.set('ready');
        },
        error: () => {
          if (seq !== this.requestSeq) return;
          this.loadingPage.set(false);
          this.stage.set('error');
        },
      });
  }

  pickTopic(value: string): void {
    this.trust.set(value === ALL || value === this.trust() ? null : (value as TrustCriterion));
    this.restart();
  }

  pickReadiness(value: string): void {
    this.readiness.set(value === ALL || value === this.readiness() ? null : (value as Readiness));
    this.restart();
  }

  clearFilters(): void {
    this.trust.set(null);
    this.readiness.set(null);
    this.restart();
  }

  goTo(page: number): void {
    this.pageNumber.set(page);
    this.load();
  }

  resize(size: number): void {
    this.pageSize.set(size);
    this.restart();
  }

  open(row: ControlListItem): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { abrir: row.id, tab: null }, queryParamsHandling: 'merge' });
  }

  closeDetail(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { abrir: null, tab: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  setTab(tab: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'summary' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Una causa del control: se abre en Causas. */
  openCause(id: string): void {
    this.router.navigate(['/', COMPLIANCE_ROUTE, 'causas'], { queryParams: { abrir: id } });
  }

  /** Los temas del control: el valor estable (decide el color del badge) y su etiqueta traducida. */
  topics(row: ControlListItem): { value: string; label: string }[] {
    const options = this.trustOptions();
    return row.trust_criteria.map((c) => ({ value: c, label: options.find((o) => o.value === c)?.label ?? c }));
  }

  private restart(): void {
    this.pageNumber.set(1);
    this.load();
  }

  private t(key: string): string {
    // Depende de `translationsTick` para que las etiquetas se recalculen al cambiar el idioma y cuando terminan de cargar las traducciones.
    this.translationsTick();
    return this.translate.instant(key);
  }
}
