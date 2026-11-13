import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { catchError, forkJoin, of } from 'rxjs';
import { RiskReadinessService } from '@shared/domain/services/risk-readiness.service';
import { RiskProgress } from '@shared/domain/utils/risk-progress';
import { Asset, TechnicalControlState } from '@shared/domain/models/technical-control.models';
import { categoryLabel } from '@shared/domain/utils/category-label';
import { platformsByCode } from '@shared/domain/utils/platform-label';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { RiskWizard } from '@shared/presentation/components/risk-wizard/risk-wizard';
import { ConnectionsList } from '@shared/presentation/components/connections-list/connections-list';
import { CatalogName, CatalogOption, FrameworkOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Service } from '@shared/domain/models/service.models';
import { FLAG_FILES, SYMBOLS } from '@features/services/domain/utils/service-display';
import { ChipOption } from '@shared/presentation/components/option-chips/option-chips';
import { ServiceService } from '@shared/domain/services/service.service';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { Section } from '@shared/presentation/components/section/section';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type Stage = 'loading' | 'error' | 'ready';
const CATALOGS: CatalogName[] = ['service_type', 'served_industry', 'service_country', 'data_type', 'trust_criterion', 'expected_availability', 'previous_certification'];

// El servicio del cliente: su información ordenada arriba y, debajo, las conexiones con las que Monkey llega a sus activos (Componente 3).
@Component({
  selector: 'app-service-detail',
  imports: [PageHeader, RouterLink, ConnectionsList, TranslatePipe, RiskWizard, EmptyState, Section, StatusIndicator, Tag, Skeleton, SkeletonRegion],
  templateUrl: './service-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceDetailView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly services = inject(ServiceService);
  private readonly api = inject(TechnicalControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly readiness = inject(RiskReadinessService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly stage = signal<Stage>('loading');
  readonly serviceId = signal('');
  readonly service = signal<Service | null>(null);
  readonly state = signal<TechnicalControlState | null>(null);
  readonly assets = signal<Asset[]>([]);
  /** D89 · Cuántos riesgos del servicio faltan por evaluar. `null` = no se pudo saber: no se bloquea nada. */
  readonly risks = signal<RiskProgress | null>(null);
  /** D89 · ¿Está abierto el asistente de riesgos aquí mismo? Se abre con el botón del aviso o al llegar con ?evaluar=riesgos (el guard de las rutas de conexión). */
  readonly evaluating = signal(false);
  readonly risksPending = computed(() => {
    const risks = this.risks();
    return risks && !risks.ready ? risks : null;
  });
  // El nombre de los marcos sale del catálogo del backend; sin él se muestra el código.
  private readonly frameworks = signal<FrameworkOption[]>([]);
  private readonly options = signal<Partial<Record<CatalogName, CatalogOption[]>>>({});

  readonly platforms = computed(() => platformsByCode(this.state()));
  readonly capabilityLabels = computed(() => Object.fromEntries((this.state()?.applicable_capabilities ?? []).map((c) => [c.catalog_code, categoryLabel(this.translate, c.catalog_code, c.category)])));

  constructor() {
    // El backend traduce los catálogos: al cambiar el idioma se vuelven a pedir, sin recrear la pantalla ni perder la selección.
    effect(() => {
      this.language.current();
      untracked(() => {
        if (this.stage() !== 'ready') return;
        forkJoin(CATALOGS.map((c) => this.catalogs.options(c))).subscribe((catalogs) =>
          this.options.set(Object.fromEntries(CATALOGS.map((c, i) => [c, catalogs[i]]))),
        );
        this.catalogs.frameworks().pipe(catchError(() => of([] as FrameworkOption[]))).subscribe((f) => this.frameworks.set(f));
      });
    });
  }

  ngOnInit(): void {
    this.serviceId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    const id = this.serviceId();
    forkJoin({
      service: this.services.get(id),
      state: this.api.state(id),
      assets: this.api.listAssets(id),
      risks: this.readiness.progress(id).pipe(catchError(() => of(null))),
      catalogs: forkJoin(CATALOGS.map((c) => this.catalogs.options(c))),
      frameworks: this.catalogs.frameworks().pipe(catchError(() => of([] as FrameworkOption[]))),
    }).subscribe({
      next: ({ service, state, assets, risks, catalogs, frameworks }) => {
        this.frameworks.set(frameworks);
        this.service.set(service);
        this.risks.set(risks);
        if (risks && !risks.ready && this.route.snapshot.queryParamMap.get('evaluar') === 'riesgos') this.evaluating.set(true);
        this.state.set(state);
        this.assets.set(assets.items);
        this.options.set(Object.fromEntries(CATALOGS.map((c, i) => [c, catalogs[i]])));
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  startEvaluating(): void {
    this.evaluating.set(true);
  }

  /** Terminó el asistente: se vuelve a preguntar cuántos faltan (ahora ninguno) y se abre el candado de «Nueva conexión». */
  finishEvaluating(): void {
    this.evaluating.set(false);
    this.readiness
      .progress(this.serviceId())
      .pipe(catchError(() => of(null)))
      .subscribe((risks) => this.risks.set(risks));
  }

  label(catalog: CatalogName, value: string | null | undefined): string {
    if (!value) return '—';
    return this.options()[catalog]?.find((o) => o.value === value)?.label ?? value;
  }

  // Los valores elegidos como etiquetas, con bandera o icono si los tienen (las mismas que en la revisión del alta).
  pills(catalog: CatalogName, values: string[] | undefined): ChipOption[] {
    return (values ?? []).map((v) => ({ value: v, label: this.label(catalog, v), ...(FLAG_FILES.has(v) ? { flag: v } : {}), ...(SYMBOLS[v] ? { symbol: SYMBOLS[v] } : {}) }));
  }

  labels(catalog: CatalogName, values: string[] | undefined): string {
    return values?.length ? values.map((v) => this.label(catalog, v)).join(', ') : '—';
  }

  frameworkLabel(code: string): string {
    return this.frameworks().find((f) => f.code === code)?.label ?? code;
  }
}
