import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { CatalogOption, FrameworkOption, RegulationOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
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
} from '../../../domain/models/service.models';
import { ServiceDraftService } from '../../../domain/services/service-draft.service';
import { ServiceService } from '../../../domain/services/service.service';

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
  regulations: RegulationOption[];
  frameworks: FrameworkOption[];
}

// Las 6 pantallas del Componente 2 (contexto del servicio) y una de revisión. Agrupan los 16
// campos del Excel por afinidad para que cada pantalla haga pocas preguntas.
const STEPS = [
  { key: 'service', label: 'Tu servicio', icon: 'inventory_2' },
  { key: 'clients', label: 'Tus clientes', icon: 'groups' },
  { key: 'data', label: 'Datos y alcance', icon: 'database' },
  { key: 'framework', label: 'Marco', icon: 'verified_user' },
  { key: 'providers', label: 'Proveedores', icon: 'cloud' },
  { key: 'compliance', label: 'Cumplimiento', icon: 'gavel' },
] as const;
const REVIEW_STEP = STEPS.length;
const TEXT_MAX = 2000;
const NONE = 'none';

// Qué significa cada criterio de confianza, dicho sin jerga (las 5 opciones son fijas: SOC 2).
const CRITERION_HELP: Record<string, string> = {
  security: 'Proteger los sistemas y los datos contra accesos no autorizados.',
  availability: 'Que el servicio esté disponible cuando tus clientes lo necesitan.',
  confidentiality: 'Mantener protegida la información confidencial de tus clientes.',
  integrity: 'Que el procesamiento de la información sea completo, válido y exacto.',
  privacy: 'Manejar los datos personales como prometiste a las personas.',
};

type Stage = 'loading' | 'error' | 'form' | 'saving' | 'done';
type MultiKey = 'industries_served' | 'countries' | 'data_types' | 'regulation_codes';
type SingleKey = 'type' | 'active_client_count' | 'expected_availability' | 'previous_certification';
type TextKey = 'name' | 'description' | 'scope_statement';
type SubserviceTextKey = 'provider' | 'service_provided' | 'responsibility';

@Component({
  selector: 'app-service-form',
  imports: [OptionChips, RouterLink],
  templateUrl: './service-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceFormView implements OnInit {
  private readonly services = inject(ServiceService);
  private readonly catalogService = inject(CatalogService);
  private readonly drafts = inject(ServiceDraftService);
  private readonly session = inject(SessionService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly steps = STEPS;
  readonly reviewStep = REVIEW_STEP;
  readonly textMax = TEXT_MAX;
  readonly criterionHelp = CRITERION_HELP;
  readonly security = SECURITY;

  readonly stage = signal<Stage>('loading');
  readonly step = signal(0);
  readonly draft = signal<ServiceDraft>(emptyServiceDraft());
  readonly catalogs = signal<Catalogs | null>(null);
  // Si hay id en la ruta se edita un servicio ya declarado; si no, se declara uno nuevo.
  readonly serviceId = signal<string | null>(null);
  readonly saved = signal<Service | null>(null);
  readonly showHints = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly needsCompany = signal(false);

  private userId: string | null = null;

  readonly editing = computed(() => this.serviceId() !== null);
  readonly stepValid = computed(() => this.isStepValid(this.step(), this.draft()));
  readonly allValid = computed(() => STEPS.every((_, i) => this.isStepValid(i, this.draft())));

  // Países del servicio: las regiones ("Unión Europea", "Latinoamérica", "Global") van aparte.
  readonly countryMain = computed(() => this.chips(this.catalogs()?.countries, 'country'));
  readonly countryRegions = computed(() => this.chips(this.catalogs()?.countries, 'region'));
  readonly regulationChips = computed<ChipOption[]>(() =>
    (this.catalogs()?.regulations ?? []).map((r) => ({ value: r.code, label: r.label })),
  );
  readonly subserviceChips = computed<ChipOption[]>(() => this.options(this.catalogs()?.subserviceTypes));
  readonly selectedSubserviceTypes = computed(() => this.draft().subservices.map((s) => s.type));
  readonly fullCoverage = computed(() => ALL_TRUST_CRITERIA.every((c) => this.draft().trust_criteria.includes(c)));
  readonly urlInvalid = computed(() => {
    const url = this.draft().system_description_url.trim();
    return url.length > 0 && !isHttpUrl(url);
  });

  constructor() {
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
      regulations: this.catalogService.regulations(),
      frameworks: this.catalogService.frameworks(),
    }).subscribe({
      next: ({ service, ...catalogs }) => {
        this.catalogs.set(catalogs);
        if (service) {
          // Ya lo había declarado: se muestra lo guardado, en la revisión, para editar lo que quiera.
          this.draft.set(draftFromService(service));
          this.step.set(REVIEW_STEP);
        } else {
          const stored = this.userId ? this.drafts.load(this.userId) : null;
          const base = stored ? { ...emptyServiceDraft(), ...stored.draft } : emptyServiceDraft();
          // Con un solo marco disponible (SOC 2) no hay nada que decidir: ya viene elegido.
          if (base.framework_codes.length === 0 && catalogs.frameworks.length === 1) {
            base.framework_codes = [catalogs.frameworks[0].code];
          }
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
    if (key === 'regulation_codes') return this.toggleRegulation(value);
    const list = this.draft()[key];
    this.patch({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  }

  // "Ninguna" significa que no le aplica ninguna: elegirla limpia las demás, y elegir otra la quita.
  private toggleRegulation(code: string): void {
    const current = this.draft().regulation_codes;
    let next: string[];
    if (code === NONE) {
      next = current.includes(NONE) ? [] : [NONE];
    } else {
      const without = current.filter((c) => c !== NONE);
      next = without.includes(code) ? without.filter((c) => c !== code) : [...without, code];
    }
    this.patch({ regulation_codes: next });
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

  toggleFramework(code: string): void {
    const list = this.draft().framework_codes;
    this.patch({ framework_codes: list.includes(code) ? list.filter((c) => c !== code) : [...list, code] });
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
    const id = this.serviceId();
    this.stage.set('saving');
    this.saveError.set(null);
    (id ? this.services.update(id, input) : this.services.create(input)).subscribe({
      next: (service) => {
        if (this.userId) this.drafts.clear(this.userId);
        this.saved.set(service);
        // Primero se refresca la sesión (el siguiente paso del onboarding lo calcula el backend) y
        // solo después se muestra «¡Listo!»: así Inicio nunca enseña por un instante el paso anterior.
        this.auth.validate().subscribe(() => {
          this.stage.set('done');
          this.scrollTop();
        });
      },
      error: (error) => {
        this.stage.set('form');
        const code = apiErrorCode(error);
        if (code === 'SERVICE_NAME_TAKEN') {
          this.saveError.set('Ya tienes un servicio con ese nombre. Elige otro para distinguirlos.');
          this.step.set(0);
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
            : apiErrorMessage(error, 'No pudimos guardar tu servicio. Inténtalo de nuevo.'),
        );
      },
    });
  }

  addAnother(): void {
    this.saved.set(null);
    this.serviceId.set(null);
    this.draft.set(this.freshDraft());
    this.step.set(0);
    this.stage.set('form');
    // El formulario es el mismo componente: la ruta cambia a "nuevo" sin recargar la pantalla.
    this.router.navigateByUrl('/services/new');
  }

  private freshDraft(): ServiceDraft {
    const base = emptyServiceDraft();
    const frameworks = this.catalogs()?.frameworks ?? [];
    if (frameworks.length === 1) base.framework_codes = [frameworks[0].code];
    return base;
  }

  // ---------- presentación ----------

  labelOf(options: { value: string; label: string }[] | undefined, value: string | null): string {
    return options?.find((o) => o.value === value)?.label ?? '—';
  }

  labelsOf(options: { value: string; label: string }[] | undefined, values: string[]): string {
    const labels = values.map((v) => options?.find((o) => o.value === v)?.label ?? v);
    return labels.length > 0 ? labels.join(', ') : '—';
  }

  regulationLabels(): string {
    const all = this.catalogs()?.regulations ?? [];
    const labels = this.draft().regulation_codes.map((c) => all.find((r) => r.code === c)?.label ?? c);
    return labels.length > 0 ? labels.join(', ') : '—';
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
      .map((o) => ({ value: o.value, label: o.label }));
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
        return d.regulation_codes.length > 0 && isHttpUrl(d.system_description_url);
      default:
        return true;
    }
  }

  private scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
