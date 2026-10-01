import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { ServiceService } from '@features/services/domain/services/service.service';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import {
  Asset,
  SCENARIO_HELP,
  SCENARIO_ICON,
  SCOPE_FIELDS,
  TechnicalControlState,
  emptyScope,
  toCount,
} from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';
import { AssetCard } from '../../components/asset-card/asset-card';
import { ConnectAssetForm } from '../../components/connect-asset-form/connect-asset-form';

const STEPS = [
  { key: 'scenario', label: 'Dónde vive' },
  { key: 'scope', label: 'Cuánto tienes' },
  { key: 'connect', label: 'Conectar' },
] as const;

type Stage = 'loading' | 'error' | 'ready';

// Componente 3 del onboarding (control técnico) de UN servicio, en tres pasos cortos: dónde vive,
// cuánto tiene (más o menos) y conectar sus sistemas. Los dos primeros bastan para dar el paso por
// hecho; conectar se recomienda pero se puede dejar para después.
@Component({
  selector: 'app-technical-control',
  imports: [AssetCard, ConnectAssetForm, RouterLink],
  templateUrl: './technical-control.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechnicalControlView implements OnInit {
  private readonly api = inject(TechnicalControlService);
  private readonly services = inject(ServiceService);
  private readonly catalogService = inject(CatalogService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly steps = STEPS;
  readonly scopeFields = SCOPE_FIELDS;
  readonly scenarioHelp = SCENARIO_HELP;
  readonly scenarioIcon = SCENARIO_ICON;

  readonly stage = signal<Stage>('loading');
  readonly step = signal(0);
  readonly serviceId = signal('');
  readonly service = signal<{ id: string; name: string } | null>(null);
  readonly otherServices = signal<{ id: string; name: string }[]>([]);
  readonly state = signal<TechnicalControlState | null>(null);
  readonly assets = signal<Asset[]>([]);
  readonly scenarios = signal<CatalogOption[]>([]);
  readonly criticalities = signal<CatalogOption[]>([]);
  readonly frequencyOptions = signal<CatalogOption[]>([]);

  readonly scenario = signal<string | null>(null);
  readonly counts = signal<Record<string, string>>(emptyScope());
  readonly showHints = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly connecting = signal(false);

  readonly scopeValid = computed(() => SCOPE_FIELDS.every((f) => toCount(this.counts()[f.key] ?? '') !== null));
  readonly probeMode = computed(() => this.state()?.probe_mode ?? 'unavailable');
  readonly connectedRows = computed(() => {
    const scope = this.state()?.scope;
    if (!scope) return [];
    return SCOPE_FIELDS.filter((f) => scope[f.key] > 0 || scope.connected[f.key] > 0).map((f) => ({
      label: f.label,
      declared: scope[f.key],
      connected: scope.connected[f.key],
    }));
  });

  ngOnInit(): void {
    this.serviceId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    const id = this.serviceId();
    forkJoin({
      state: this.api.state(id),
      service: this.services.get(id),
      list: this.services.list(),
      assets: this.api.listAssets(id),
      scenarios: this.catalogService.options('deployment_scenario'),
      criticalities: this.catalogService.options('asset_criticality'),
      frequencies: this.catalogService.options('schedule_frequency'),
    }).subscribe({
      next: ({ state, service, list, assets, scenarios, criticalities, frequencies }) => {
        this.service.set({ id: service.id, name: service.name });
        // Otros servicios que ya tienen escenario: son los únicos a los que se puede enlazar un sistema.
        this.otherServices.set(
          list.items
            .filter((s) => s.id !== id && s.technical_control.deployment_scenario)
            .map((s) => ({ id: s.id, name: s.name })),
        );
        this.assets.set(assets.items);
        this.scenarios.set(scenarios);
        this.criticalities.set(criticalities);
        this.frequencyOptions.set(frequencies);
        this.applyState(state);
        // Donde se quedó: sin escenario → paso 1; sin scope → paso 2; si no, directo a conectar.
        this.step.set(!state.deployment_scenario ? 0 : !state.scope ? 1 : 2);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  private applyState(state: TechnicalControlState): void {
    this.state.set(state);
    this.scenario.set(state.deployment_scenario);
    if (state.scope) {
      this.counts.set(
        Object.fromEntries(SCOPE_FIELDS.map((f) => [f.key, String(state.scope![f.key])])) as Record<string, string>,
      );
    }
  }

  private refreshState(): void {
    this.api.state(this.serviceId()).subscribe((s) => this.state.set(s));
  }

  // ---------- pasos ----------

  pickScenario(value: string): void {
    this.scenario.set(value);
  }

  // Solo números. El valor limpio se escribe también en el campo: si el estado no cambia (p. ej. se
  // teclea una letra tras «12»), Angular no vuelve a pintarlo y la letra quedaría a la vista.
  setCount(key: string, input: HTMLInputElement): void {
    const clean = input.value.replace(/[^\d]/g, '').slice(0, 7);
    input.value = clean;
    this.counts.update((c) => ({ ...c, [key]: clean }));
  }

  goTo(step: number): void {
    // Se puede volver a un paso ya hecho, nunca saltar hacia adelante sin completarlo.
    const s = this.state();
    const reachable = step === 0 || (step === 1 && !!s?.deployment_scenario) || (step === 2 && !!s?.deployment_scenario && !!s.scope);
    if (!reachable) return;
    this.showHints.set(false);
    this.saveError.set(null);
    this.step.set(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  next(): void {
    this.saveError.set(null);
    if (this.step() === 0) this.saveScenario();
    else if (this.step() === 1) this.saveScope();
  }

  private saveScenario(): void {
    const scenario = this.scenario();
    if (!scenario) {
      this.showHints.set(true);
      return;
    }
    this.saving.set(true);
    this.api.setScenario(this.serviceId(), scenario).subscribe({
      next: () => {
        this.api.state(this.serviceId()).subscribe({
          next: (s) => {
            this.saving.set(false);
            this.applyState(s);
            this.showHints.set(false);
            this.step.set(s.scope ? 2 : 1);
            this.afterProgress();
          },
          error: () => this.saving.set(false),
        });
      },
      error: (error) => {
        this.saving.set(false);
        if (apiErrorCode(error) === 'CAPABILITY_NOT_APPLICABLE') {
          const codes = error instanceof HttpErrorResponse ? (error.error?.error?.assets as string[] | undefined) : undefined;
          this.saveError.set(
            `No podemos cambiar a ese escenario porque ya registraste sistemas que quedarían fuera${codes?.length ? ` (${codes.join(', ')})` : ''}. Elige uno que los incluya, por ejemplo «Mixto».`,
          );
          return;
        }
        this.saveError.set(apiErrorMessage(error, 'No pudimos guardar tu respuesta. Inténtalo de nuevo.'));
      },
    });
  }

  private saveScope(): void {
    if (!this.scopeValid()) {
      this.showHints.set(true);
      return;
    }
    const c = this.counts();
    const body = {
      server_count: toCount(c['server_count'])!,
      cloud_count: toCount(c['cloud_count'])!,
      app_count: toCount(c['app_count'])!,
      database_count: toCount(c['database_count'])!,
      endpoint_count: toCount(c['endpoint_count'])!,
    };
    this.saving.set(true);
    this.api.setScope(this.serviceId(), body).subscribe({
      next: () => {
        this.api.state(this.serviceId()).subscribe({
          next: (s) => {
            this.saving.set(false);
            this.applyState(s);
            this.step.set(2);
            this.afterProgress();
          },
          error: () => this.saving.set(false),
        });
      },
      error: (error) => {
        this.saving.set(false);
        const fields = apiFieldErrors(error);
        this.saveError.set(
          fields.length > 0 ? fields.map((f) => f.message).join(' ') : apiErrorMessage(error, 'No pudimos guardar tus números. Inténtalo de nuevo.'),
        );
      },
    });
  }

  // El progreso del onboarding lo calcula el backend: se vuelve a pedir para que Inicio quede al día.
  private afterProgress(): void {
    this.auth.validate().subscribe();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- sistemas ----------

  onCreated(asset: Asset): void {
    this.connecting.set(false);
    this.assets.update((list) => [...list, asset]);
    this.refreshState();
  }

  onChanged(asset: Asset): void {
    this.assets.update((list) => list.map((a) => (a.id === asset.id ? asset : a)));
    this.refreshState();
  }

  connectionLabel(code: string): string {
    return this.state()?.applicable_capabilities.find((c) => c.catalog_code === code)?.category ?? 'Sistema conectado';
  }

  // Frecuencias que admite una conexión, según el catálogo: «6-24 h» → cada 6 o 24 horas; el resto, continua.
  frequenciesFor(code: string): CatalogOption[] {
    const base = this.state()?.applicable_capabilities.find((c) => c.catalog_code === code)?.base_frequency ?? '';
    const wanted = base.includes('6-24') ? ['every_6h', 'every_24h'] : ['continuous'];
    return this.frequencyOptions().filter((f) => wanted.includes(f.value));
  }

  finish(): void {
    this.router.navigateByUrl('/services');
  }
}
