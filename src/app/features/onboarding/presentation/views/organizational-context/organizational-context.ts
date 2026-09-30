import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { CatalogOption, RegulationOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import {
  OrganizationalContextDraft,
  draftFromContext,
  emptyDraft,
} from '../../../domain/models/organizational-context.models';
import { OnboardingDraftService } from '../../../domain/services/onboarding-draft.service';
import { OnboardingService } from '../../../domain/services/onboarding.service';
import { ChipOption, OptionChips } from '../../components/option-chips/option-chips';

interface Catalogs {
  size: CatalogOption[];
  years: CatalogOption[];
  industry: CatalogOption[];
  businessModel: CatalogOption[];
  incorporation: CatalogOption[];
  client: CatalogOption[];
  maturity: CatalogOption[];
  regulations: RegulationOption[];
}

// Las 5 pantallas del Componente 1 (contexto organizacional) y una de revisión. Agrupan campos
// que van naturalmente juntos para que no sean 10 pantallas; cada una hace pocas preguntas.
const STEPS = [
  { key: 'company', label: 'Tu empresa', icon: 'apartment' },
  { key: 'size', label: 'Tamaño', icon: 'groups' },
  { key: 'business', label: 'Tu negocio', icon: 'storefront' },
  { key: 'reach', label: 'Alcance', icon: 'public' },
  { key: 'compliance', label: 'Cumplimiento', icon: 'verified_user' },
] as const;
const REVIEW_STEP = STEPS.length;
const DESCRIPTION_MAX = 2000;
const NONE = 'none';

type Stage = 'loading' | 'error' | 'form' | 'saving' | 'done';
type MultiKey = 'incorporation_countries' | 'client_countries' | 'regulation_codes';
type SingleKey = 'size' | 'years_in_operation' | 'industry' | 'business_model' | 'compliance_maturity';

@Component({
  selector: 'app-organizational-context',
  imports: [OptionChips],
  templateUrl: './organizational-context.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationalContextView implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly catalogService = inject(CatalogService);
  private readonly drafts = inject(OnboardingDraftService);
  private readonly session = inject(SessionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly steps = STEPS;
  readonly reviewStep = REVIEW_STEP;
  readonly descriptionMax = DESCRIPTION_MAX;

  readonly stage = signal<Stage>('loading');
  readonly step = signal(0);
  readonly draft = signal<OrganizationalContextDraft>(emptyDraft());
  readonly companyName = signal('');
  readonly catalogs = signal<Catalogs | null>(null);
  readonly alreadySaved = signal(false);
  readonly showHints = signal(false);
  readonly saveError = signal<string | null>(null);

  private userId: string | null = null;

  // Un paso se puede dejar atrás solo si lo obligatorio está contestado.
  readonly stepValid = computed(() => this.isStepValid(this.step(), this.draft()));
  readonly allValid = computed(() => STEPS.every((_, i) => this.isStepValid(i, this.draft())));
  readonly progress = computed(() => Math.round((Math.min(this.step(), STEPS.length) / STEPS.length) * 100));

  // Países: "Unión Europea" y "Otro" van aparte de los países (la fuente los mezcla en una lista).
  readonly incorporationMain = computed(() => this.chips(this.catalogs()?.incorporation, 'country'));
  readonly incorporationExtra = computed(() => this.chips(this.catalogs()?.incorporation, 'extra'));
  readonly clientMain = computed(() => this.chips(this.catalogs()?.client, 'country'));
  readonly clientExtra = computed(() => this.chips(this.catalogs()?.client, 'extra'));
  readonly regulationChips = computed<ChipOption[]>(() =>
    (this.catalogs()?.regulations ?? []).map((r) => ({ value: r.code, label: r.label })),
  );

  constructor() {
    // Guarda el avance en el navegador mientras el cliente escribe (solo si aún no hay nada
    // guardado en el backend: si ya lo hay, el backend es la verdad).
    effect(() => {
      const draft = this.draft();
      const step = this.step();
      if (this.userId && this.stage() === 'form' && !this.alreadySaved()) {
        this.drafts.save(this.userId, { draft, step: Math.min(step, REVIEW_STEP) });
      }
    });
  }

  ngOnInit(): void {
    this.userId = this.session.user()?.id ?? null;
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    forkJoin({
      ctx: this.onboarding.get(),
      size: this.catalogService.options('size'),
      years: this.catalogService.options('years_in_operation'),
      industry: this.catalogService.options('industry'),
      businessModel: this.catalogService.options('business_model'),
      incorporation: this.catalogService.options('incorporation_country'),
      client: this.catalogService.options('client_country'),
      maturity: this.catalogService.options('compliance_maturity'),
      regulations: this.catalogService.regulations(),
    }).subscribe({
      next: ({ ctx, ...catalogs }) => {
        this.catalogs.set(catalogs);
        this.companyName.set(ctx.name);
        if (ctx.id) {
          // Ya la había llenado: se muestra lo guardado, en la revisión, para editar lo que quiera.
          this.alreadySaved.set(true);
          this.draft.set(draftFromContext(ctx));
          this.step.set(REVIEW_STEP);
        } else {
          const stored = this.userId ? this.drafts.load(this.userId) : null;
          if (stored) {
            this.draft.set({ ...emptyDraft(), ...stored.draft });
            this.step.set(Math.min(Math.max(stored.step, 0), REVIEW_STEP));
          }
        }
        this.stage.set('form');
      },
      error: () => this.stage.set('error'),
    });
  }

  // ---------- respuestas ----------

  setDescription(value: string): void {
    this.patch({ description: value.slice(0, DESCRIPTION_MAX) });
  }

  pick(key: SingleKey, value: string): void {
    const current = this.draft()[key];
    // El único opcional (años en operación) se puede des-elegar volviendo a tocarlo.
    this.patch({ [key]: key === 'years_in_operation' && current === value ? null : value });
  }

  toggle(key: MultiKey, value: string): void {
    const list = this.draft()[key];
    if (key === 'regulation_codes') return this.toggleRegulation(value);
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

  private patch(change: Partial<OrganizationalContextDraft>): void {
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
    const d = this.draft();
    this.stage.set('saving');
    this.saveError.set(null);
    this.onboarding
      .save({
        description: d.description.trim(),
        size: d.size!,
        industry: d.industry!,
        business_model: d.business_model!,
        years_in_operation: d.years_in_operation,
        incorporation_countries: d.incorporation_countries,
        client_countries: d.client_countries,
        compliance_maturity: d.compliance_maturity!,
        regulation_codes: d.regulation_codes,
      })
      .subscribe({
        next: () => {
          if (this.userId) this.drafts.clear(this.userId);
          this.alreadySaved.set(true);
          // Vuelve a pedir la sesión para que el siguiente paso del onboarding quede al día.
          this.auth.validate().subscribe();
          this.stage.set('done');
          this.scrollTop();
        },
        error: (error) => {
          this.stage.set('form');
          const fields = apiFieldErrors(error);
          this.saveError.set(
            fields.length > 0
              ? fields.map((f) => f.message).join(' ')
              : apiErrorMessage(error, 'No pudimos guardar tu información. Inténtalo de nuevo.'),
          );
        },
      });
  }

  finish(): void {
    this.router.navigateByUrl('/');
  }

  // ---------- presentación ----------

  labelOf(options: CatalogOption[] | undefined, value: string | null): string {
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

  private chips(options: CatalogOption[] | undefined, part: 'country' | 'extra'): ChipOption[] {
    return (options ?? [])
      .filter((o) => (part === 'country' ? o.group === 'country' : o.group !== 'country'))
      .map((o) => ({ value: o.value, label: o.label }));
  }

  private isStepValid(step: number, d: OrganizationalContextDraft): boolean {
    switch (step) {
      case 0:
        return d.description.trim().length > 0;
      case 1:
        return !!d.size;
      case 2:
        return !!d.industry && !!d.business_model;
      case 3:
        return d.incorporation_countries.length > 0 && d.client_countries.length > 0;
      case 4:
        return !!d.compliance_maturity && d.regulation_codes.length > 0;
      default:
        return true;
    }
  }

  private scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
