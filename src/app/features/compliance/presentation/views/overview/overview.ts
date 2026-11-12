import { storedLanguage } from '@core/domain/services/language.service';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { formatPercent, percentOf } from '@shared/domain/utils/percentage';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { Card } from '@shared/presentation/components/card/card';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { PageInfo } from '@shared/presentation/components/data-table/table-page';
import { Donut, DonutTone } from '@shared/presentation/components/donut/donut';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { readinessLook } from '@shared/domain/utils/readiness-look';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';
import { ActiveComplianceService } from '@features/compliance/domain/services/active-compliance.service';
import { COMPLIANCE_ROUTE } from '@features/compliance/domain/models/compliance.models';
import { RiskListItem } from '@shared/domain/models/risk.models';
import { FailingAffected, OverviewCategory, OverviewFailingControl, OverviewFramework, OverviewReadiness, RollupState } from '@features/compliance/domain/models/overview.models';
import { ComplianceContextService } from '@features/compliance/domain/services/compliance-context.service';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { OverviewService } from '@features/compliance/domain/services/overview.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { EvaluationPeriodForm } from '../../components/evaluation-period-form/evaluation-period-form';
import { RiskHeatmap } from '../../components/risk-heatmap/risk-heatmap';

type Stage = 'loading' | 'error' | 'ready';
type Tone = DonutTone;

interface Banner {
  tone: Tone;
  titleKey: string;
  bodyKey: string;
}

/** Un control que requiere atención: una sola fila aunque falle en dos categorías. */
interface AttentionRow {
  id: string;
  code: string;
  name: string;
  readiness: string;
  categories: string[];
  failing: { dimension: string; affected: FailingAffected[] }[];
  /** Pruebas que cumplen / total del control: solo la vista técnica lo trae. */
  tests: { done: number; total: number } | null;
}

const PAGE_SIZES = [10, 25, 50];

// La pestaña «Resumen» de un servicio (MD-140), según la pantalla «Estado de cumplimiento» del comité: el veredicto del marco (todo o nada), el avance y la cobertura por
// separado, los criterios de confianza y los controles que requieren atención. El avance NO es el estado: «80 %» puede convivir con «No cumple». Lo pendiente, en revisión o
// vencido nunca cuenta como cumplido, y sin resultados no se inventa ningún porcentaje. El cumplimiento se mide por servicio × marco; nunca hay un total de la empresa.
@Component({
  selector: 'app-overview',
  imports: [TranslatePipe, RouterLink, StatusIndicator, Tag, Card, Donut, EmptyState, DataTable, TableCell, LoadingSpinner, RiskHeatmap, EvaluationPeriodForm],
  templateUrl: './overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewView {
  protected readonly readinessLook = readinessLook;
  private readonly api = inject(OverviewService);
  private readonly riskApi = inject(RiskService);
  private readonly catalogs = inject(CatalogService);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly view = inject(ComplianceViewService);
  /** Lo que se comparte con el encabezado del servicio: el marco elegido y el período de su evaluación. */
  readonly context = inject(ComplianceContextService);

  // El servicio activo lo elige el encabezado de Cumplimiento y se recuerda entre secciones (`ActiveComplianceService`).
  private readonly activeService = inject(ActiveComplianceService);
  readonly serviceId = computed(() => this.activeService.serviceId() ?? '');

  readonly stage = signal<Stage>('loading');
  readonly frameworks = signal<OverviewFramework[]>([]);
  /** Los riesgos del servicio, para la matriz inherente; `null` mientras llegan o si no se pudieron leer (la matriz solo se muestra con ellos). */
  readonly risks = signal<RiskListItem[] | null>(null);

  // Los nombres de las categorías y de las dimensiones salen del catálogo del backend (según el idioma de la sesión); aquí no hay listas escritas a mano.
  private readonly criteria = signal<CatalogOption[]>([]);
  private readonly dimensions = signal<CatalogOption[]>([]);
  private requestSeq = 0;

  readonly controlsLink = computed(() => ['/', COMPLIANCE_ROUTE, 'controles']);

  readonly framework = computed<OverviewFramework | null>(() => {
    const all = this.frameworks();
    return all.find((f) => f.framework_code === this.context.selected()) ?? all[0] ?? null;
  });

  /** Sin período auditado el motor no ejecuta (D87): se dice, en vez de dejar una pantalla en «Sin medir» sin explicación. La fecha de corte no hace falta: sin congelar es hoy. */
  readonly evaluationDefined = computed(() => {
    const e = this.framework()?.evaluation;
    return !!e && e.period_start !== null && e.period_end !== null;
  });

  /** Solo el administrador de la empresa declara el período (la API lo exige: 403 al resto). */
  readonly canEditPeriod = computed(() => this.view.canManage());
  readonly periodOpen = signal(false);
  readonly notice = signal<string | null>(null);

  readonly measured = computed(() => (this.framework()?.readiness ?? 'not_measured') !== 'not_measured');

  /** El veredicto: con la vista técnica, el estado del motor (cumple / no cumple / en evaluación); con la de negocio, el semáforo de cuatro niveles. */
  readonly banner = computed<Banner | null>(() => {
    const fw = this.framework();
    if (!fw) return null;
    if (fw.readiness === 'not_measured') return { tone: 'neutral', titleKey: 'COMMON.READINESS.LABEL.NOT_MEASURED', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.NOT_MEASURED' };
    if (fw.technical) {
      const byState: Record<RollupState, Banner> = {
        compliant: { tone: 'ok', titleKey: 'COMPLIANCE.OVERVIEW.VERDICT.COMPLIANT', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.COMPLIANT' },
        non_compliant: { tone: 'bad', titleKey: 'COMPLIANCE.OVERVIEW.VERDICT.NON_COMPLIANT', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.NON_COMPLIANT' },
        evaluating: { tone: 'warn', titleKey: 'COMPLIANCE.OVERVIEW.VERDICT.EVALUATING', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.EVALUATING' },
        no_controls: { tone: 'neutral', titleKey: 'COMPLIANCE.OVERVIEW.VERDICT.NO_CONTROLS', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.NO_CONTROLS' },
        out_of_scope: { tone: 'neutral', titleKey: 'COMPLIANCE.OVERVIEW.VERDICT.NO_CONTROLS', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.NO_CONTROLS' },
      };
      return byState[fw.technical.state];
    }
    const level = fw.readiness as OverviewReadiness;
    const tone: Tone = level === 'ready' ? 'ok' : level === 'needs_work' ? 'bad' : 'warn';
    return { tone, titleKey: `COMMON.READINESS.LABEL.${level.toUpperCase()}`, bodyKey: `COMMON.READINESS.HINT.${level.toUpperCase()}` };
  });

  readonly counts = computed(() => {
    const fw = this.framework();
    if (!fw) return null;
    const { done, total } = fw.progress;
    const { measured } = fw.coverage;
    return { total, done, measured, notEffective: Math.max(0, measured - done), pending: Math.max(0, total - measured) };
  });

  /** Los controles que no cumplen, sin repetir el que falla en dos categorías. */
  readonly attention = computed<AttentionRow[]>(() => {
    const fw = this.framework();
    if (!fw) return [];
    const rows = new Map<string, AttentionRow>();
    for (const category of fw.categories) {
      for (const f of category.failing_controls) {
        const seen = rows.get(f.control_id);
        if (seen) {
          seen.categories.push(category.trust_criterion);
          continue;
        }
        rows.set(f.control_id, this.toRow(f, category));
      }
    }
    return [...rows.values()].sort((a, b) => a.code.localeCompare(b.code, storedLanguage(), { numeric: true }));
  });

  /** La tabla se pagina aquí, sobre la lista que ya llegó: no se pide nada más al servidor. */
  readonly attentionPageSizes = PAGE_SIZES;
  private readonly attentionPageSize = signal(PAGE_SIZES[0]);
  private readonly attentionPageRequested = signal(1);
  readonly attentionPageInfo = computed<PageInfo>(() => {
    const total = this.attention().length;
    const pageSize = this.attentionPageSize();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { page: Math.min(this.attentionPageRequested(), totalPages), pageSize, total, totalPages };
  });
  readonly attentionPage = computed<AttentionRow[]>(() => {
    const { page, pageSize } = this.attentionPageInfo();
    return this.attention().slice((page - 1) * pageSize, page * pageSize);
  });
  readonly attentionColumns: TableColumn<AttentionRow>[] = [
    { key: 'code', headerKey: 'COMPLIANCE.OVERVIEW.ATTENTION_COL.CODE', class: 'w-28' },
    { key: 'name', headerKey: 'COMPLIANCE.OVERVIEW.ATTENTION_COL.CONTROL' },
    { key: 'failing', headerKey: 'COMPLIANCE.OVERVIEW.ATTENTION_COL.FAILS' },
    { key: 'status', headerKey: 'COMPLIANCE.OVERVIEW.ATTENTION_COL.STATUS' },
  ];
  readonly attentionKey = (r: AttentionRow): string => r.id;

  goToAttentionPage(page: number): void {
    this.attentionPageRequested.set(page);
  }

  resizeAttention(size: number): void {
    this.attentionPageSize.set(size);
    this.attentionPageRequested.set(1);
  }

  constructor() {
    // El backend traduce los catálogos: al cambiar el idioma se vuelven a pedir.
    effect(() => {
      this.language.current();
      untracked(() => {
        this.catalogs.options('trust_criterion').subscribe((o) => this.criteria.set(o));
        this.catalogs.options('dimension').subscribe((o) => this.dimensions.set(o));
      });
    });
    effect(() => {
      this.serviceId();
      this.view.viewParam();
      untracked(() => this.load());
    });
    // El encabezado muestra el período de la evaluación y deja elegir el marco: aquí se le dice cuál es y si hay más de uno.
    effect(() => {
      this.language.current();
      const fw = this.framework();
      const e = fw?.evaluation;
      const text = fw && this.evaluationDefined() && e
        ? this.translate.instant('COMPLIANCE.OVERVIEW.EVALUATION', { start: this.day(e.period_start), end: this.day(e.period_end), version: e.catalog_version })
        : null;
      untracked(() => {
        this.context.evaluationText.set(text);
        this.context.selectable.set(this.frameworks().length > 1);
        // «Cambiar período» vive en el banner: solo se ofrece a quien puede y con el período ya definido.
        this.context.editPeriod.set(this.canEditPeriod() && this.evaluationDefined() ? () => this.openPeriod() : null);
        if (fw && this.context.selected() !== fw.framework_code) this.context.selected.set(fw.framework_code);
      });
    });
    // La línea de contexto del banner: el veredicto del marco en texto y su significado (el porcentaje, la cobertura y el estado están en las tarjetas de abajo).
    effect(() => {
      const b = this.banner();
      untracked(() => this.context.insight.set(b ? { kind: 'status', statusKey: b.titleKey, hintKey: b.bodyKey } : null));
    });
    // El período y el marco son de esta pestaña: al salir, el encabezado vuelve a estar sin ellos.
    this.destroyRef.onDestroy(() => this.context.clear());
  }

  load(): void {
    const seq = ++this.requestSeq;
    this.stage.set('loading');
    this.risks.set(null);
    this.riskApi.listAllRisks(this.serviceId(), this.view.viewParam()).subscribe({ next: (list) => seq === this.requestSeq && this.risks.set(list), error: () => undefined });
    this.api.get(this.serviceId(), this.view.viewParam()).subscribe({
      next: (overview) => {
        if (seq !== this.requestSeq) return;
        this.frameworks.set(overview.frameworks);
        this.stage.set('ready');
      },
      error: () => {
        if (seq === this.requestSeq) this.stage.set('error');
      },
    });
  }

  pick(code: string): void {
    this.context.selected.set(code);
  }

  openPeriod(): void {
    this.notice.set(null);
    this.periodOpen.set(true);
  }

  /** Se guardó el período: se cierra el panel, se avisa y se vuelve a pedir el resumen (el motor ya puede medir). */
  onPeriodSaved(): void {
    this.periodOpen.set(false);
    this.notice.set(this.translate.instant('COMPLIANCE.PERIOD.SAVED'));
    this.load();
  }

  // ---- lo que se pinta ------------------------------------------------------------------------------------------------------------------------

  /** «60 %» (o «—» sin total), en el idioma de la sesión. */
  pct(part: number, total: number): string {
    return formatPercent(percentOf(part, total), this.language.current());
  }

  value(part: number, total: number): number | null {
    return percentOf(part, total);
  }

  /** El color de una dona sale del semáforo (tokens de estado); sin medir es neutro, no rojo. */
  tone(readiness: string): DonutTone {
    return readiness === 'ready' ? 'ok' : readiness === 'needs_work' ? 'bad' : readiness === 'almost_ready' ? 'warn' : 'neutral';
  }

  /** Una dona sin total o sin medir queda vacía: ni un 0 % inventado. */
  donutValue(readiness: string, part: number, total: number): number | null {
    return readiness === 'not_measured' ? null : this.value(part, total);
  }

  donutText(readiness: string, part: number, total: number): string {
    return readiness === 'not_measured' ? '—' : this.pct(part, total);
  }

  criterionLabel(value: string): string {
    return this.criteria().find((o) => o.value === value)?.label ?? value;
  }

  dimensionLabel(value: string): string {
    return this.dimensions().find((o) => o.value === value)?.label ?? value;
  }

  affectedName(a: FailingAffected): string {
    return a.kind === 'asset' ? a.name : a.display_name;
  }

  /** Las fechas llegan como `AAAA-MM-DD`: se muestran en el idioma de la sesión, sin que la zona horaria las corra un día. */
  day(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat(this.language.current(), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  }

  private toRow(f: OverviewFailingControl, category: OverviewCategory): AttentionRow {
    const line = category.technical?.controls.find((c) => c.control_id === f.control_id);
    return {
      id: f.control_id,
      code: f.code,
      name: f.name,
      readiness: f.readiness,
      categories: [category.trust_criterion],
      failing: f.failing,
      tests: line ? { done: line.progress.done, total: line.progress.total } : null,
    };
  }
}
