import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { catchError, forkJoin, of } from 'rxjs';
import { apiErrorCode, apiErrorMessage } from '@core/domain/utils/api-error';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { RiskReadinessService } from '@features/compliance/domain/services/risk-readiness.service';
import { RiskProgress } from '@features/compliance/domain/utils/risk-progress';
import { Asset, SCENARIO_HELP, SCENARIO_ICON, TechnicalControlState } from '@features/technical-control/domain/models/technical-control.models';
import { categoryLabel } from '@features/technical-control/domain/utils/category-label';
import { TechnicalControlService } from '@features/technical-control/domain/services/technical-control.service';
import { RiskWizard } from '@features/compliance/presentation/components/risk-wizard/risk-wizard';
import { ConnectionsList } from '@features/technical-control/presentation/components/connections-list/connections-list';
import { CatalogName, CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { Service } from '../../../domain/models/service.models';
import { ServiceService } from '../../../domain/services/service.service';
import { HttpErrorResponse } from '@angular/common/http';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';

type Stage = 'loading' | 'error' | 'ready';
const CATALOGS: CatalogName[] = ['service_type', 'served_industry', 'service_country', 'data_type', 'trust_criterion', 'expected_availability', 'previous_certification', 'deployment_scenario'];

// El servicio del cliente: su información ordenada arriba y, debajo, las conexiones con las que Monkey llega a sus activos (Componente 3).
@Component({
  selector: 'app-service-detail',
  imports: [PageHeader, RouterLink, ConnectionsList, LoadingSpinner, TranslatePipe, RiskWizard],
  templateUrl: './service-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceDetailView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly services = inject(ServiceService);
  private readonly api = inject(TechnicalControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly auth = inject(AuthService);
  private readonly readiness = inject(RiskReadinessService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly scenarioHelp = SCENARIO_HELP;
  readonly scenarioIcon = SCENARIO_ICON;

  readonly stage = signal<Stage>('loading');
  readonly serviceId = signal('');
  readonly service = signal<Service | null>(null);
  readonly state = signal<TechnicalControlState | null>(null);
  readonly assets = signal<Asset[]>([]);
  /** D89 · Cuántos riesgos del servicio faltan por evaluar. 
ull = no se pudo saber: no se bloquea nada. */
  readonly risks = signal<RiskProgress | null>(null);
  /** D89 · ¿Está abierto el asistente de riesgos aquí mismo? Se abre con el botón del aviso o al llegar con ?evaluar=riesgos (el guard de las rutas de conexión). */
  readonly evaluating = signal(false);
  readonly risksPending = computed(() => (this.risks() && !this.risks()!.ready ? this.risks() : null));
  private readonly options = signal<Partial<Record<CatalogName, CatalogOption[]>>>({});

  // «Dónde vive»: se elige al principio y se puede cambiar.
  readonly choosing = signal(false);
  readonly pending = signal<string | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly scenario = computed(() => this.state()?.deployment_scenario ?? null);
  readonly scenarios = computed(() => this.options()['deployment_scenario'] ?? []);
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
    }).subscribe({
      next: ({ service, state, assets, risks, catalogs }) => {
        this.service.set(service);
        this.risks.set(risks);
        if (risks && !risks.ready && this.route.snapshot.queryParamMap.get('evaluar') === 'riesgos') this.evaluating.set(true);
        this.state.set(state);
        this.assets.set(assets.items);
        this.options.set(Object.fromEntries(CATALOGS.map((c, i) => [c, catalogs[i]])));
        // Sin escenario no hay qué proponer: se le pide primero.
        this.choosing.set(!state.deployment_scenario);
        this.pending.set(state.deployment_scenario);
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

  labels(catalog: CatalogName, values: string[] | undefined): string {
    return values?.length ? values.map((v) => this.label(catalog, v)).join(', ') : '—';
  }

  frameworkLabel(code: string): string {
    return code === 'soc2' ? 'SOC 2' : code;
  }

  saveScenario(): void {
    const scenario = this.pending();
    if (!scenario || scenario === this.scenario()) {
      this.choosing.set(false);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.setScenario(this.serviceId(), scenario).subscribe({
      next: () => {
        this.api.state(this.serviceId()).subscribe({
          next: (state) => {
            this.saving.set(false);
            this.state.set(state);
            this.choosing.set(false);
            // El progreso del onboarding lo calcula el backend: se vuelve a pedir para que Inicio quede al día.
            this.auth.validate().subscribe();
          },
          error: () => this.saving.set(false),
        });
      },
      error: (error) => {
        this.saving.set(false);
        if (apiErrorCode(error) === 'CAPABILITY_NOT_APPLICABLE') {
          const codes = error instanceof HttpErrorResponse ? (error.error?.error?.assets as string[] | undefined) : undefined;
          this.error.set(this.translate.instant(codes?.length ? 'SERVICES.DETAIL.SCENARIO_BLOCKED_WITH_CODES' : 'SERVICES.DETAIL.SCENARIO_BLOCKED', { codes: codes?.join(', ') }));
          return;
        }
        this.error.set(apiErrorMessage(error, this.translate.instant('SERVICES.DETAIL.SAVE_ERROR')));
      },
    });
  }
}
