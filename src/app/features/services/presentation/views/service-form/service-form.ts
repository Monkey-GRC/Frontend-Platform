import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { Observable, catchError, forkJoin, of, switchMap, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { AuthService } from '@core/domain/services/auth.service';
import { CatalogOption, FrameworkOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { Modal } from '@shared/presentation/components/modal/modal';
import { ChipOption, OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import {
  ALL_TRUST_CRITERIA,
  SECURITY,
  Service,
  ServiceDraft,
  draftFromService,
  emptyServiceDraft,
  inputFromDraft,
  isHttpUrl,
  systemDescriptionFileError,
} from '@shared/domain/models/service.models';
import { FLAG_FILES, SYMBOLS } from '@features/services/domain/utils/service-display';
import { ServiceDraftService } from '@features/services/domain/services/service-draft.service';
import { ServiceService } from '@shared/domain/services/service.service';
import { RiskWizard } from '@shared/presentation/components/risk-wizard/risk-wizard';
import { targetValue } from '@shared/presentation/utils/event-target';

interface Catalogs {
  type: CatalogOption[];
  industries: CatalogOption[];
  clientCount: CatalogOption[];
  countries: CatalogOption[];
  dataTypes: CatalogOption[];
  availability: CatalogOption[];
  trustCriteria: CatalogOption[];
  subserviceTypes: CatalogOption[];
  certifications: CatalogOption[];
  // Todos los marcos que Monkey ofrece (gancho comercial); `contracted` son los que esta empresa puede elegir (D50).
  frameworks: FrameworkOption[];
  contracted: FrameworkOption[];
}

// Las 6 pantallas del Componente 2 (contexto del servicio) y una de revisión. Agrupan los 16
// campos del Excel por afinidad para que cada pantalla haga pocas preguntas.
const STEPS = [
  { key: 'service', labelKey: 'SERVICES.FORM.STEPS.SERVICE' },
  { key: 'clients', labelKey: 'SERVICES.FORM.STEPS.CLIENTS' },
  { key: 'data', labelKey: 'SERVICES.FORM.STEPS.DATA' },
  { key: 'framework', labelKey: 'SERVICES.FORM.STEPS.FRAMEWORK' },
  { key: 'providers', labelKey: 'SERVICES.FORM.STEPS.PROVIDERS' },
  { key: 'compliance', labelKey: 'SERVICES.FORM.STEPS.COMPLIANCE' },
] as const;
const REVIEW_STEP = STEPS.length;
const FRAMEWORK_STEP = 3;
const TEXT_MAX = 2000;

// Qué significa cada categoría de SOC 2, dicho sin jerga y con ejemplos de lo que revisaremos contigo.
// Los textos son claves de traducción (services.json).
// Hoy solo SOC 2 está construido; cuando llegue otro marco tendrá sus propias categorías (D50).
interface CriterionInfo {
  help: string;
  examples: string[];
}
const CRITERION_INFO: Record<string, CriterionInfo> = {
  security: {
    help: 'SERVICES.FORM.CRITERIA.SECURITY.HELP',
    examples: ['SERVICES.FORM.CRITERIA.SECURITY.EX1', 'SERVICES.FORM.CRITERIA.SECURITY.EX2', 'SERVICES.FORM.CRITERIA.SECURITY.EX3'],
  },
  availability: {
    help: 'SERVICES.FORM.CRITERIA.AVAILABILITY.HELP',
    examples: ['SERVICES.FORM.CRITERIA.AVAILABILITY.EX1', 'SERVICES.FORM.CRITERIA.AVAILABILITY.EX2', 'SERVICES.FORM.CRITERIA.AVAILABILITY.EX3'],
  },
  confidentiality: {
    help: 'SERVICES.FORM.CRITERIA.CONFIDENTIALITY.HELP',
    examples: ['SERVICES.FORM.CRITERIA.CONFIDENTIALITY.EX1', 'SERVICES.FORM.CRITERIA.CONFIDENTIALITY.EX2', 'SERVICES.FORM.CRITERIA.CONFIDENTIALITY.EX3'],
  },
  integrity: {
    help: 'SERVICES.FORM.CRITERIA.INTEGRITY.HELP',
    examples: ['SERVICES.FORM.CRITERIA.INTEGRITY.EX1', 'SERVICES.FORM.CRITERIA.INTEGRITY.EX2', 'SERVICES.FORM.CRITERIA.INTEGRITY.EX3'],
  },
  privacy: {
    help: 'SERVICES.FORM.CRITERIA.PRIVACY.HELP',
    examples: ['SERVICES.FORM.CRITERIA.PRIVACY.EX1', 'SERVICES.FORM.CRITERIA.PRIVACY.EX2', 'SERVICES.FORM.CRITERIA.PRIVACY.EX3'],
  },
};

type Stage = 'loading' | 'error' | 'form' | 'saving' | 'risks' | 'done';
type MultiKey = 'industries_served' | 'countries' | 'data_types';
type SingleKey = 'type' | 'active_client_count' | 'expected_availability' | 'previous_certification';
type TextKey = 'name' | 'description' | 'scope_statement';
// El nombre del proveedor ya no se pregunta: el tipo que eligió (AWS, Azure…) ya lo dice.
type SubserviceTextKey = 'service_provided' | 'responsibility';

@Component({
  selector: 'app-service-form',
  imports: [OptionChips, RouterLink, TranslatePipe, RiskWizard, EmptyState, Modal],
  templateUrl: './service-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceFormView implements OnInit {
  protected readonly targetValue = targetValue;
  private readonly services = inject(ServiceService);
  private readonly catalogService = inject(CatalogService);
  private readonly drafts = inject(ServiceDraftService);
  private readonly session = inject(SessionService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly steps = STEPS;
  readonly reviewStep = REVIEW_STEP;
  readonly textMax = TEXT_MAX;
  readonly criterionInfo = CRITERION_INFO;
  readonly security = SECURITY;

  readonly stage = signal<Stage>('loading');
  readonly step = signal(0);
  /** El asistente y el paso de riesgos usan todo el ancho; el resto del alta (cargando, error, terminado) queda en una columna angosta. */
  readonly wide = computed(() => this.stage() === 'form' || this.stage() === 'saving' || this.stage() === 'risks');
  readonly draft = signal<ServiceDraft>(emptyServiceDraft());
  readonly catalogs = signal<Catalogs | null>(null);
  // Si hay id en la ruta se edita un servicio ya declarado; si no, se declara uno nuevo.
  readonly serviceId = signal<string | null>(null);
  readonly saved = signal<Service | null>(null);
  readonly showHints = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly needsCompany = signal(false);

  private userId: string | null = null;
  // El servicio se guardó pero el archivo no se pudo subir (para decir qué falló).
  private uploadFailed = false;

  readonly editing = computed(() => this.serviceId() !== null);
  readonly stepValid = computed(() => this.isStepValid(this.step(), this.draft()));
  readonly allValid = computed(() => STEPS.every((_, i) => this.isStepValid(i, this.draft())));

  // Países del servicio: las regiones ("Unión Europea", "Latinoamérica", "Global") van aparte.
  readonly countryMain = computed(() => this.chips(this.catalogs()?.countries, 'country'));
  readonly countryRegions = computed(() => this.chips(this.catalogs()?.countries, 'region'));
  readonly subserviceChips = computed<ChipOption[]>(() => this.options(this.catalogs()?.subserviceTypes));
  readonly selectedSubserviceTypes = computed(() => this.draft().subservices.map((s) => s.type));
  readonly fullCoverage = computed(() => ALL_TRUST_CRITERIA.every((c) => this.draft().trust_criteria.includes(c)));
  readonly urlInvalid = computed(() => {
    const url = this.draft().system_description_url.trim();
    return url.length > 0 && !isHttpUrl(url);
  });

  // Descripción del Sistema (D51): el enlace, un archivo de su equipo, o las dos. Con una basta.
  // El archivo elegido no se guarda en el navegador con el borrador: si recarga, lo vuelve a elegir.
  readonly systemFile = signal<File | null>(null);
  readonly systemFileError = signal<string | null>(null);
  // El archivo que ya está guardado en el servidor (al editar un servicio).
  readonly existingFileName = signal<string | null>(null);
  readonly hasSystemDescription = computed(
    () => isHttpUrl(this.draft().system_description_url) || !!this.systemFile() || !!this.existingFileName(),
  );

  // Marcos: se muestran todos; solo se pueden elegir los que la empresa contrató. Elegir otro abre el aviso
  // de ventas (mock por ahora, DT-38) en vez de seleccionarlo.
  readonly salesFramework = signal<FrameworkOption | null>(null);
  readonly contractedCodes = computed(() => new Set((this.catalogs()?.contracted ?? []).map((f) => f.code)));

  // Alerta de cobertura parcial: se avisa una vez por combinación de categorías; si sigue igual, se respeta.
  readonly coverageWarning = signal(false);
  private coverageAcknowledged: string | null = null;

  constructor() {
    // El backend traduce los catálogos: al cambiar el idioma se vuelven a pedir, sin recrear la pantalla ni tocar lo escrito.
    effect(() => {
      this.language.current();
      untracked(() => {
        if (this.catalogs()) this.fetchCatalogs().subscribe((fresh) => this.catalogs.set(fresh));
      });
    });
    // Guarda el avance en el navegador mientras el cliente escribe (solo en un servicio nuevo).
    effect(() => {
      const draft = this.draft();
      const step = this.step();
      if (this.userId && this.stage() === 'form' && !this.editing()) {
        this.drafts.save(this.userId, { draft, step: Math.min(step, REVIEW_STEP) });
      }
    });
  }

  ngOnInit(): void {
    this.userId = this.session.user()?.id ?? null;
    this.serviceId.set(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  private fetchCatalogs(): Observable<Catalogs> {
    return forkJoin({
      type: this.catalogService.options('service_type'),
      industries: this.catalogService.options('served_industry'),
      clientCount: this.catalogService.options('active_client_count'),
      countries: this.catalogService.options('service_country'),
      dataTypes: this.catalogService.options('data_type'),
      availability: this.catalogService.options('expected_availability'),
      trustCriteria: this.catalogService.options('trust_criterion'),
      subserviceTypes: this.catalogService.options('subservice_type'),
      certifications: this.catalogService.options('previous_certification'),
      frameworks: this.catalogService.frameworks(),
      contracted: this.catalogService.contractedFrameworks(),
    });
  }

  load(): void {
    // El servicio cuelga de la empresa: sin ella declarada todavía, primero va esa parte.
    if (this.session.onboarding()?.next_step === 'organizational_context') {
      this.needsCompany.set(true);
      this.stage.set('form');
      return;
    }
    this.stage.set('loading');
    const id = this.serviceId();
    const service$: Observable<Service | null> = id ? this.services.get(id) : of(null);
    forkJoin({
      service: service$,
      type: this.catalogService.options('service_type'),
      industries: this.catalogService.options('served_industry'),
      clientCount: this.catalogService.options('active_client_count'),
      countries: this.catalogService.options('service_country'),
      dataTypes: this.catalogService.options('data_type'),
      availability: this.catalogService.options('expected_availability'),
      trustCriteria: this.catalogService.options('trust_criterion'),
      subserviceTypes: this.catalogService.options('subservice_type'),
      certifications: this.catalogService.options('previous_certification'),
      // Todos los marcos que Monkey ofrece, y aparte los que esta empresa tiene contratados (D47, D50).
      frameworks: this.catalogService.frameworks(),
      contracted: this.catalogService.contractedFrameworks(),
    }).subscribe({
      next: ({ service, ...catalogs }) => {
        this.catalogs.set(catalogs);
        if (service) {
          // Ya lo había declarado: se muestra lo guardado, en la revisión, para editar lo que quiera.
          this.draft.set(draftFromService(service));
          this.existingFileName.set(service.system_description?.file_name ?? null);
          this.step.set(REVIEW_STEP);
        } else {
          const stored = this.userId ? this.drafts.load(this.userId) : null;
          const base = stored ? { ...emptyServiceDraft(), ...stored.draft } : emptyServiceDraft();
          // Con un solo marco contratado (hoy, SOC 2) no hay nada que decidir: ya viene elegido.
          if (base.framework_codes.length === 0 && catalogs.contracted.length === 1) {
            base.framework_codes = [catalogs.contracted[0].code];
          }
          // Un borrador viejo pudo guardar un marco que ya no está contratado: se descarta.
          base.framework_codes = base.framework_codes.filter((c) => catalogs.contracted.some((f) => f.code === c));
          if (!base.trust_criteria.includes(SECURITY)) base.trust_criteria = [SECURITY, ...base.trust_criteria];
          this.draft.set(base);
          if (stored) this.step.set(Math.min(Math.max(stored.step, 0), REVIEW_STEP));
        }
        this.stage.set('form');
      },
      error: () => this.stage.set('error'),
    });
  }

  // ---------- respuestas ----------

  setText(key: TextKey, value: string): void {
    this.patch({ [key]: value.slice(0, TEXT_MAX) });
  }

  setUrl(value: string): void {
    this.patch({ system_description_url: value });
  }

  pick(key: SingleKey, value: string): void {
    const current = this.draft()[key];
    // Los opcionales (número de clientes y certificación previa) se des-eligen volviendo a tocarlos.
    const optional = key === 'active_client_count' || key === 'previous_certification';
    this.patch({ [key]: optional && current === value ? null : value });
  }

  toggle(key: MultiKey, value: string): void {
    const list = this.draft()[key];
    this.patch({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  }

  // ---------- archivo de la Descripción del Sistema ----------

  pickSystemFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // permite volver a elegir el mismo archivo después de quitarlo
    if (!file) return;
    const problem = systemDescriptionFileError(file);
    this.systemFileError.set(problem ? this.translate.instant(problem) : null);
    this.systemFile.set(problem ? null : file);
  }

  // Pide un enlace temporal (5 min) y abre el archivo guardado; el almacenamiento no es público.
  downloadExistingFile(): void {
    const id = this.serviceId();
    if (!id) return;
    this.services.systemDescriptionDownload(id).subscribe({
      next: (link) => window.open(link.url, '_blank', 'noopener'),
      error: (error) =>
        this.systemFileError.set(apiErrorMessage(error, this.translate.instant('SERVICES.FORM.OPEN_FILE_ERROR'))),
    });
  }

  clearSystemFile(): void {
    this.systemFile.set(null);
    this.systemFileError.set(null);
  }

  toggleCriterion(value: string): void {
    if (value === SECURITY) return; // siempre incluido
    const list = this.draft().trust_criteria;
    this.patch({ trust_criteria: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  }

  // Atajo "Cobertura completa sugerida por Monkey": marca los cinco. Si ya están, deja solo seguridad.
  toggleFullCoverage(): void {
    this.patch({ trust_criteria: this.fullCoverage() ? [SECURITY] : [...ALL_TRUST_CRITERIA] });
  }

  isContracted(code: string): boolean {
    return this.contractedCodes().has(code);
  }

  // Un marco contratado se marca o desmarca; uno que no, abre el aviso de ventas y no se selecciona.
  pickFramework(framework: FrameworkOption): void {
    if (!this.isContracted(framework.code)) {
      this.salesFramework.set(framework);
      return;
    }
    const list = this.draft().framework_codes;
    this.patch({
      framework_codes: list.includes(framework.code)
        ? list.filter((c) => c !== framework.code)
        : [...list, framework.code],
    });
  }

  closeSales(): void {
    this.salesFramework.set(null);
  }

  // Cubrir todas las categorías es lo recomendable; si el cliente decide no hacerlo, se respeta (D50).
  private coverageKey(): string {
    return [...this.draft().trust_criteria].sort().join(',');
  }

  keepPartialCoverage(): void {
    this.coverageAcknowledged = this.coverageKey();
    this.coverageWarning.set(false);
    this.advance();
  }

  coverAll(): void {
    this.patch({ trust_criteria: [...ALL_TRUST_CRITERIA] });
    this.coverageWarning.set(false);
  }

  dismissCoverageWarning(): void {
    this.coverageWarning.set(false);
  }

  // Elegir un tipo de proveedor agrega su ficha; quitarlo la saca. Una ficha por tipo.
  toggleSubservice(type: string): void {
    const list = this.draft().subservices;
    this.patch({
      subservices: list.some((s) => s.type === type)
        ? list.filter((s) => s.type !== type)
        : [...list, { type, provider: '', service_provided: '', responsibility: '' }],
    });
  }

  setSubserviceText(type: string, key: SubserviceTextKey, value: string): void {
    this.patch({
      subservices: this.draft().subservices.map((s) => (s.type === type ? { ...s, [key]: value.slice(0, 1000) } : s)),
    });
  }

  private patch(change: Partial<ServiceDraft>): void {
    this.draft.update((d) => ({ ...d, ...change }));
  }

  // ---------- navegación ----------

  next(): void {
    if (!this.stepValid()) {
      this.showHints.set(true);
      return;
    }
    // En el paso del marco, cubrir solo parte de las categorías pide confirmación (una vez por combinación).
    if (this.step() === FRAMEWORK_STEP && !this.fullCoverage() && this.coverageAcknowledged !== this.coverageKey()) {
      this.coverageWarning.set(true);
      return;
    }
    this.advance();
  }

  private advance(): void {
    this.showHints.set(false);
    this.step.update((s) => s + 1);
    this.scrollTop();
  }

  back(): void {
    this.showHints.set(false);
    this.step.update((s) => Math.max(0, s - 1));
    this.scrollTop();
  }

  goTo(step: number): void {
    this.showHints.set(false);
    this.step.set(step);
    this.scrollTop();
  }

  // ---------- guardar ----------

  save(): void {
    if (!this.allValid()) {
      // No debería pasar (la revisión solo se alcanza con todo contestado), pero se protege.
      const firstPending = STEPS.findIndex((_, i) => !this.isStepValid(i, this.draft()));
      this.showHints.set(true);
      this.step.set(Math.max(firstPending, 0));
      return;
    }
    const input = inputFromDraft(this.draft());
    if (!input) return;
    const id = this.serviceId();
    // Se decide antes de guardar: al subir el archivo el formulario ya guarda el id del servicio nuevo y parecería una edición (D89).
    const creating = !id;
    const file = this.systemFile();
    this.stage.set('saving');
    this.saveError.set(null);

    // Con archivo: primero el servicio y, ya con id, el archivo. Si el archivo falla, el servicio queda
    // guardado y el formulario pasa a editarlo (no se crea otro al reintentar).
    const request$ = (id ? this.services.update(id, input) : this.services.create(input)).pipe(
      switchMap((service) => {
        if (!file) return of(service);
        this.serviceId.set(service.id);
        return this.services.uploadSystemDescription(service.id, file).pipe(
          catchError((error) => {
            this.uploadFailed = true;
            return throwError(() => error);
          }),
        );
      }),
    );
    this.uploadFailed = false;

    request$.subscribe({
      next: (service) => {
        if (this.userId) this.drafts.clear(this.userId);
        this.saved.set(service);
        this.systemFile.set(null);
        // Primero se refresca la sesión (el siguiente paso del onboarding lo calcula el backend) y
        // solo después se muestra «¡Listo!»: así Inicio nunca enseña por un instante el paso anterior.
        this.auth.validate().subscribe(() => {
          // D89 · Un servicio nuevo sigue la cadena en esta misma pantalla: crear → evaluar sus riesgos → declarar sus activos. Editar uno existente se queda en «Listo».
          this.stage.set(creating ? 'risks' : 'done');
          this.scrollTop();
        });
      },
      error: (error) => {
        if (this.uploadFailed) {
          this.stage.set('form');
          this.step.set(5);
          this.saveError.set(
            this.translate.instant('SERVICES.FORM.UPLOAD_FAILED') + ' ' +
              apiErrorMessage(error, this.translate.instant('SERVICES.FORM.UPLOAD_RETRY')),
          );
          return;
        }
        this.stage.set('form');
        const code = apiErrorCode(error);
        if (code === 'SERVICE_NAME_TAKEN') {
          this.saveError.set(this.translate.instant('SERVICES.FORM.NAME_TAKEN'));
          this.step.set(0);
          return;
        }
        if (code === 'FRAMEWORK_NOT_CONTRACTED') {
          this.saveError.set(apiErrorMessage(error, this.translate.instant('SERVICES.FORM.FRAMEWORK_NOT_CONTRACTED')));
          this.step.set(FRAMEWORK_STEP);
          return;
        }
        if (code === 'ORGANIZATION_NOT_DECLARED') {
          this.needsCompany.set(true);
          return;
        }
        const fields = apiFieldErrors(error);
        this.saveError.set(
          fields.length > 0
            ? fields.map((f) => f.message).join(' ')
            : apiErrorMessage(error, this.translate.instant('SERVICES.FORM.SAVE_ERROR')),
        );
      },
    });
  }

  /** Terminada la evaluación de los riesgos, sigue declarar los activos del servicio (el detalle ofrece directamente el catálogo de plataformas donde conectar). */
  goToAssets(): void {
    const id = this.saved()?.id;
    this.router.navigateByUrl(id ? `/services/${id}` : '/services');
  }

  addAnother(): void {
    this.saved.set(null);
    this.serviceId.set(null);
    this.systemFile.set(null);
    this.systemFileError.set(null);
    this.existingFileName.set(null);
    this.coverageAcknowledged = null;
    this.draft.set(this.freshDraft());
    this.step.set(0);
    this.stage.set('form');
    // El formulario es el mismo componente: la ruta cambia a "nuevo" sin recargar la pantalla.
    this.router.navigateByUrl('/services/new');
  }

  private freshDraft(): ServiceDraft {
    const base = emptyServiceDraft();
    const contracted = this.catalogs()?.contracted ?? [];
    if (contracted.length === 1) base.framework_codes = [contracted[0].code];
    return base;
  }

  // ---------- presentación ----------

  /** Una opción elegida como lista de un elemento (o vacía) para los chips de selección única. */
  asList(value: string | null): string[] {
    return value ? [value] : [];
  }

  labelOf(options: { value: string; label: string }[] | undefined, value: string | null): string {
    return options?.find((o) => o.value === value)?.label ?? '—';
  }

  labelsOf(options: { value: string; label: string }[] | undefined, values: string[]): string {
    const labels = values.map((v) => options?.find((o) => o.value === v)?.label ?? v);
    return labels.length > 0 ? labels.join(', ') : '—';
  }

  // Valores elegidos como etiquetas (con bandera o icono si el catálogo lo tiene) para la pantalla de revisión; sin nada elegido, lista vacía.
  pillsOf(options: { value: string; label: string }[] | undefined, values: string[]): ChipOption[] {
    return values.map((v) => {
      const label = options?.find((o) => o.value === v)?.label ?? v;
      return { value: v, label, ...(FLAG_FILES.has(v) ? { flag: v } : {}), ...(SYMBOLS[v] ? { symbol: SYMBOLS[v] } : {}) };
    });
  }

  frameworkPills(): ChipOption[] {
    const all = this.catalogs()?.frameworks ?? [];
    return this.draft().framework_codes.map((c) => ({ value: c, label: all.find((f) => f.code === c)?.label ?? c }));
  }

  frameworkLabels(): string {
    const all = this.catalogs()?.frameworks ?? [];
    const labels = this.draft().framework_codes.map((c) => all.find((f) => f.code === c)?.label ?? c);
    return labels.length > 0 ? labels.join(', ') : '—';
  }

  options(list: CatalogOption[] | undefined): ChipOption[] {
    return (list ?? []).map((o) => ({ value: o.value, label: o.label }));
  }

  private chips(options: CatalogOption[] | undefined, part: 'country' | 'region'): ChipOption[] {
    return (options ?? [])
      .filter((o) => (part === 'country' ? o.group === 'country' : o.group !== 'country'))
      .map((o) => ({ value: o.value, label: o.label, ...(FLAG_FILES.has(o.value) ? { flag: o.value } : {}), ...(SYMBOLS[o.value] ? { symbol: SYMBOLS[o.value] } : {}) }));
  }

  private isStepValid(step: number, d: ServiceDraft): boolean {
    switch (step) {
      case 0:
        return !!d.name.trim() && !!d.description.trim() && !!d.scope_statement.trim();
      case 1:
        return !!d.type && d.industries_served.length > 0;
      case 2:
        return d.countries.length > 0 && d.data_types.length > 0 && !!d.expected_availability;
      case 3:
        return d.trust_criteria.length > 0 && d.framework_codes.length > 0;
      case 4:
        return d.subservices.length > 0;
      case 5:
        // La Descripción del Sistema: el enlace, un archivo, o las dos. Con una basta; si escribió un
        // enlace, tiene que ser válido.
        return !this.urlInvalid() && this.hasSystemDescription();
      default:
        return true;
    }
  }

  private scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
