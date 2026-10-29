import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { READINESS_LEVELS, Readiness } from '@shared/domain/models/readiness.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { PageInfo } from '@shared/domain/utils/pagination';
import { formatPercent, percentOf } from '@shared/domain/utils/percentage';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { StatusBadge } from '@shared/presentation/components/status-badge/status-badge';
import { ControlListItem, TrustCriterion, controlCode, requirementCodes } from '../../../domain/models/control.models';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';
import { ControlService } from '../../../domain/services/control.service';
import { ControlDetailPanel } from '../../components/control-detail-panel/control-detail-panel';

type Stage = 'loading' | 'error' | 'ready';

const ALL = 'all';
const PAGE_SIZE = 25;

// La pestaña «Controles» de un servicio (MD-120). Las categorías (los criterios de confianza de SOC 2) agrupan la lista: elegir una vuelve a
// pedir al backend con ese filtro, así la paginación sigue siendo la del servidor. Cada control muestra, a la vez, su estado cualitativo, su
// porcentaje de cumplimiento y su cobertura, con los conteos entre paréntesis (D80); nunca un porcentaje solo. «Sin medir» no es un fallo.
@Component({
  selector: 'app-controls-list',
  imports: [TranslatePipe, DataTable, TableCell, OptionChips, StatusBadge, LoadingSpinner, ControlDetailPanel],
  templateUrl: './controls-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlsListView {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly view = inject(ComplianceViewService);

  // La lista es hija de `services/:id/cumplimiento`: el id del servicio está en la ruta del padre.
  private readonly params = toSignal(this.route.parent!.paramMap, { requireSync: true });
  readonly serviceId = computed(() => this.params().get('id') ?? '');

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
  readonly selected = signal<string | null>(null);

  // Una petición más nueva descarta la respuesta de una anterior (cambios rápidos de filtro o de página).
  private requestSeq = 0;

  readonly topicChips = computed(() => [
    { value: ALL, label: this.t('COMPLIANCE.CONTROLS.ALL_TOPICS') },
    ...this.trustOptions().map((o) => ({ value: o.value, label: o.label })),
  ]);

  // Los estados salen del enum del backend (`readiness`) y su texto del glosario ya aprobado (`COMPLIANCE.STATUS`).
  readonly readinessChips = computed(() => [
    { value: ALL, label: this.t('COMPLIANCE.CONTROLS.ALL_STATUSES') },
    ...READINESS_LEVELS.map((level) => ({ value: level, label: this.t(`COMPLIANCE.STATUS.${level.toUpperCase()}`) })),
  ]);

  // D80: el código se muestra siempre. La columna aparece en cuanto el backend manda códigos (hoy solo los trae en la vista técnica, para auditor y
  // administrador de la empresa); mientras no haya ninguno en la página no se pinta una columna vacía.
  readonly hasCodes = computed(() => this.rows().some((r) => controlCode(r) !== null));

  readonly columns = computed<TableColumn<ControlListItem>[]>(() => [
    ...(this.hasCodes() ? [{ key: 'code', headerKey: 'COMPLIANCE.CONTROLS.COLUMN_TECHNICAL' }] : []),
    { key: 'name', headerKey: 'COMPLIANCE.CONTROLS.COLUMN_NAME' },
    { key: 'topics', headerKey: 'COMPLIANCE.CONTROLS.COLUMN_TOPIC' },
    { key: 'status', headerKey: 'COMPLIANCE.CONTROLS.COLUMN_STATUS' },
    { key: 'counts', headerKey: 'COMPLIANCE.CONTROLS.COLUMN_PROGRESS' },
  ]);

  readonly codeOf = controlCode;
  readonly requirementsOf = requirementCodes;
  readonly percentOf = percentOf;

  /** «60 %» (o «—» sin total), en el idioma de la sesión. */
  pct(part: number, total: number): string {
    return formatPercent(percentOf(part, total), this.language.current());
  }

  readonly rowKey = (row: ControlListItem): string => row.id;
  readonly hasFilters = computed(() => this.trust() !== null || this.readiness() !== null);

  private readonly translationsTick = signal(0);

  constructor() {
    merge(this.translate.onLangChange, this.translate.onTranslationChange)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.translationsTick.update((n) => n + 1));
    // El backend traduce los catálogos: al cambiar el idioma se vuelven a pedir, sin recrear la pantalla ni perder los filtros.
    effect(() => {
      this.language.current();
      untracked(() => this.catalogs.options('trust_criterion').subscribe((options) => this.trustOptions.set(options)));
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
    this.selected.set(row.id);
  }

  topicLabels(row: ControlListItem): string {
    const options = this.trustOptions();
    return row.trust_criteria.map((c) => options.find((o) => o.value === c)?.label ?? c).join(', ');
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
