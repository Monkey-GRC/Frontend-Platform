import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { formatPercent, percentOf } from '@shared/domain/utils/percentage';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { StatusBadge } from '@shared/presentation/components/status-badge/status-badge';
import { COMPLIANCE_ROUTE } from '../../../domain/models/compliance.models';
import { RiskListItem } from '../../../domain/models/risk.models';
import { FailingAffected, OverviewCategory, OverviewFailingControl, OverviewFramework, OverviewReadiness, RollupState } from '../../../domain/models/overview.models';
import { ComplianceContextService } from '../../../domain/services/compliance-context.service';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';
import { OverviewService } from '../../../domain/services/overview.service';
import { RiskService } from '../../../domain/services/risk.service';
import { EvaluationPeriodForm } from '../../components/evaluation-period-form/evaluation-period-form';
import { ProgressRing, RingTone } from '../../components/progress-ring/progress-ring';
import { RiskHeatmap } from '../../components/risk-heatmap/risk-heatmap';

type Stage = 'loading' | 'error' | 'ready';
type Tone = 'green' | 'amber' | 'red' | 'gray';

interface Banner {
  tone: Tone;
  icon: string;
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

// Los colores del banner y de los anillos: el rojo es «no cumple», el verde «cumple», el ámbar «casi / en evaluación» y el gris «sin medir» (leyenda del comité).
const BANNER_CLASS: Record<Tone, string> = {
  // Tonos profundos, no los más brillantes de cada color: el veredicto se lee de lejos sin gritar.
  // En modo oscuro el veredicto se apaga un escalón (más oscuro y con un filo de su color): sobre un fondo oscuro, el rojo de día deslumbra.
  green: 'bg-linear-to-br from-success-700 to-success-800 text-white dark:from-success-800 dark:to-success-950 dark:ring-1 dark:ring-inset dark:ring-success-500/30',
  amber: 'bg-linear-to-br from-amber-300 to-amber-400 text-amber-950 dark:from-amber-700 dark:to-amber-800 dark:text-white dark:ring-1 dark:ring-inset dark:ring-amber-400/30',
  red: 'bg-linear-to-br from-error-700 to-error-800 text-white dark:from-error-800 dark:to-error-950 dark:ring-1 dark:ring-inset dark:ring-error-500/30',
  gray: 'bg-linear-to-br from-gray-600 to-gray-700 text-white dark:from-gray-700 dark:to-gray-800 dark:ring-1 dark:ring-inset dark:ring-white/10',
};
// El veredicto lleva su color lleno: es lo primero que se lee de la pantalla. El icono ya no necesita su propio color (va sobre un cristal blanco).
const ICON_CLASS: Record<Tone, string> = { green: '', amber: '', red: '', gray: '' };

// El acento de una tarjeta de categoría sale del estado (semáforo), nunca de la categoría: Seguridad y Disponibilidad se distinguen por su nombre, no por un color propio.
const ACCENT_CLASS: Record<string, string> = {
  ready: 'border-l-green-600',
  almost_ready: 'border-l-amber-500',
  needs_work: 'border-l-red-700',
  not_measured: 'border-l-gray-300 dark:border-l-gray-600',
};

// La pestaña «Resumen» de un servicio (MD-140), según la pantalla «Estado de cumplimiento» del comité: el veredicto del marco (todo o nada), el avance y la cobertura por
// separado, los criterios de confianza y los controles que requieren atención. El avance NO es el estado: «80 %» puede convivir con «No cumple». Lo pendiente, en revisión o
// vencido nunca cuenta como cumplido, y sin resultados no se inventa ningún porcentaje. El cumplimiento se mide por servicio × marco; nunca hay un total de la empresa.
@Component({
  selector: 'app-overview',
  imports: [TranslatePipe, RouterLink, StatusBadge, LoadingSpinner, ProgressRing, RiskHeatmap, EvaluationPeriodForm],
  templateUrl: './overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewView {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OverviewService);
  private readonly riskApi = inject(RiskService);
  private readonly catalogs = inject(CatalogService);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly view = inject(ComplianceViewService);
  /** Lo que se comparte con el encabezado del servicio: el marco elegido y el período de su evaluación. */
  readonly context = inject(ComplianceContextService);

  // La vista es hija de `services/:id/cumplimiento`: el id del servicio está en la ruta del padre.
  private readonly params = toSignal(this.route.parent!.paramMap, { requireSync: true });
  readonly serviceId = computed(() => this.params().get('id') ?? '');

  readonly stage = signal<Stage>('loading');
  readonly frameworks = signal<OverviewFramework[]>([]);
  /** Los riesgos del servicio, para la matriz inherente; `null` mientras llegan o si no se pudieron leer (la matriz solo se muestra con ellos). */
  readonly risks = signal<RiskListItem[] | null>(null);

  // Los nombres de las categorías y de las dimensiones salen del catálogo del backend (según el idioma de la sesión); aquí no hay listas escritas a mano.
  private readonly criteria = signal<CatalogOption[]>([]);
  private readonly dimensions = signal<CatalogOption[]>([]);
  private requestSeq = 0;

  readonly controlsLink = computed(() => ['/services', this.serviceId(), COMPLIANCE_ROUTE, 'controles']);

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
    if (fw.readiness === 'not_measured') return { tone: 'gray', icon: 'hourglass_empty', titleKey: 'COMPLIANCE.STATUS.NOT_MEASURED', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.NOT_MEASURED' };
    if (fw.technical) {
      const byState: Record<RollupState, Banner> = {
        compliant: { tone: 'green', icon: 'check', titleKey: 'COMPLIANCE.OVERVIEW.VERDICT.COMPLIANT', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.COMPLIANT' },
        non_compliant: { tone: 'red', icon: 'close', titleKey: 'COMPLIANCE.OVERVIEW.VERDICT.NON_COMPLIANT', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.NON_COMPLIANT' },
        evaluating: { tone: 'amber', icon: 'timelapse', titleKey: 'COMPLIANCE.OVERVIEW.VERDICT.EVALUATING', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.EVALUATING' },
        no_controls: { tone: 'gray', icon: 'hourglass_empty', titleKey: 'COMPLIANCE.OVERVIEW.VERDICT.NO_CONTROLS', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.NO_CONTROLS' },
        out_of_scope: { tone: 'gray', icon: 'hourglass_empty', titleKey: 'COMPLIANCE.OVERVIEW.VERDICT.NO_CONTROLS', bodyKey: 'COMPLIANCE.OVERVIEW.BODY.NO_CONTROLS' },
      };
      return byState[fw.technical.state];
    }
    const level = fw.readiness as OverviewReadiness;
    const tone: Tone = level === 'ready' ? 'green' : level === 'needs_work' ? 'red' : 'amber';
    return { tone, icon: level === 'ready' ? 'check' : level === 'needs_work' ? 'close' : 'timelapse', titleKey: `COMPLIANCE.STATUS.${level.toUpperCase()}`, bodyKey: `COMPLIANCE.STATUS_HINT.${level.toUpperCase()}` };
  });

  readonly bannerClass = computed(() => BANNER_CLASS[this.banner()?.tone ?? 'gray']);
  readonly iconClass = computed(() => ICON_CLASS[this.banner()?.tone ?? 'gray']);

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
    return [...rows.values()].sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
  });

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
        if (fw && this.context.selected() !== fw.framework_code) this.context.selected.set(fw.framework_code);
      });
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

  /** El color de un anillo sale del semáforo; sin medir es gris, no rojo. */
  tone(readiness: string): RingTone {
    return readiness === 'ready' ? 'green' : readiness === 'needs_work' ? 'red' : readiness === 'almost_ready' ? 'amber' : 'gray';
  }

  accent(readiness: string): string {
    return ACCENT_CLASS[readiness] ?? ACCENT_CLASS['not_measured'];
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
