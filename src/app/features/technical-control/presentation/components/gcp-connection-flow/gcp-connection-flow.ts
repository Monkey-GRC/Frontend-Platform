import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, forkJoin, of, switchMap } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogOption, ConnectionOption } from '@shared/domain/models/catalog.models';
import { Asset, Platform } from '@shared/domain/models/technical-control.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { LeaveMode } from '@features/technical-control/domain/services/wizard-leave.service';
import { resumeStep } from '@shared/domain/utils/connection-resume';
import { defaultOption, isSelectable } from '@features/technical-control/domain/utils/connection-options';
import { isGcpProjectId, isGcpProjectNumber } from '@features/technical-control/domain/utils/gcp-validation';
import { CONNECTION_STEPS, ConnectionWizardShell } from '../connection-wizard-shell/connection-wizard-shell';
import { OptionsLoadState } from '../connection-options-state/connection-options-state';
import { ConnectionResultStep } from '../connection-result-step/connection-result-step';
import { GcpAccessStep } from '../gcp-access-step/gcp-access-step';
import { GcpCheckStep } from '../gcp-check-step/gcp-check-step';
import { GcpChooseStep } from '../gcp-choose-step/gcp-choose-step';
import { GcpProjectStep } from '../gcp-project-step/gcp-project-step';

type Step = 'choose' | 'project' | 'access' | 'check' | 'result';

// El recorrido sale de lo que el backend soporta para GCP (D112): elegir cómo → datos del proyecto (aquí nace el activo y Monkey entrega el comando) → dar el acceso → entregar el
// número de proyecto y comprobar → resultado. Una cosa por pantalla. Una vez creado el activo no se vuelve a «datos» (editarlos se hace desde la conexión).
const STEPS: readonly Step[] = ['choose', 'project', 'access', 'check', 'result'];
const NEXT_LABEL: Record<Step, string> = {
  choose: 'TECHNICAL_CONTROL.WIZARD.NEXT',
  project: 'TECHNICAL_CONTROL.WIZARD.NEXT',
  access: 'TECHNICAL_CONTROL.WIZARD.GCP.ACCESS.DONE',
  check: 'TECHNICAL_CONTROL.CARD.CHECK_CONNECTION',
  result: 'TECHNICAL_CONTROL.WIZARD.RESULT.OPEN',
};

@Component({
  selector: 'app-gcp-connection-flow',
  imports: [ConnectionWizardShell, GcpChooseStep, GcpProjectStep, GcpAccessStep, GcpCheckStep, ConnectionResultStep],
  templateUrl: './gcp-connection-flow.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GcpConnectionFlow implements OnInit {
  private readonly api = inject(TechnicalControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly platform = input.required<Platform>();
  readonly service = input.required<{ id: string; name: string }>();
  readonly otherServices = input<{ id: string; name: string }[]>([]);
  readonly criticalities = input<CatalogOption[]>([]);
  // Un activo a medias que se retoma: se abre en el paso que toca, derivado de lo que el servidor ya tiene.
  readonly resume = input<Asset | null>(null);

  readonly closed = output<void>();
  readonly openConnection = output<Asset>();

  protected readonly steps = CONNECTION_STEPS;
  readonly step = signal<Step>('choose');
  readonly current = computed(() => STEPS.indexOf(this.step()) + 1);

  // Las opciones (alcance y método) las sirve el backend con su disponibilidad y sus etiquetas (D114).
  readonly optionsState = signal<OptionsLoadState>('loading');
  readonly scopes = signal<ConnectionOption[]>([]);
  readonly methods = signal<ConnectionOption[]>([]);
  readonly scope = signal<string | null>(null);
  readonly method = signal<string | null>(null);

  readonly projectId = signal('');
  readonly name = signal('');
  readonly criticality = signal('medium');
  readonly extraServiceIds = signal<string[]>([]);
  readonly showHints = signal(false);
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly error = signal<string | null>(null);

  readonly asset = signal<Asset | null>(null);
  readonly projectNumber = signal('');
  readonly numberError = signal<string | null>(null);
  readonly message = signal<{ kind: 'error' | 'info'; text: string } | null>(null);
  readonly demo = signal(false);
  readonly saving = signal(false);
  readonly checking = signal(false);

  readonly leaveMode = computed<LeaveMode>(() => (this.step() === 'result' ? 'none' : this.asset() ? 'saved' : this.step() === 'choose' ? 'none' : 'discard'));
  readonly busy = computed(() => this.saving() || this.checking());
  readonly setup = computed(() => this.asset()?.connection_setup ?? null);
  readonly showBack = computed(() => this.step() === 'project' || this.step() === 'check');
  readonly nextLabelKey = computed(() => (this.step() === 'check' && this.message()?.kind === 'error' ? 'TECHNICAL_CONTROL.CARD.CHECK_AGAIN' : NEXT_LABEL[this.step()]));
  readonly nextDisabled = computed(() => {
    switch (this.step()) {
      case 'choose':
        return !this.chooseValid();
      case 'access':
        return !this.setup()?.setup_command;
      default:
        return false;
    }
  });

  private readonly chooseValid = computed(() => this.optionsState() === 'ready' && isSelectable(this.scopes(), this.scope()) && isSelectable(this.methods(), this.method()));

  constructor() {
    // El backend traduce las opciones y los pasos de la conexión: al cambiar el idioma se vuelven a pedir.
    effect(() => {
      this.language.current();
      untracked(() => {
        this.loadOptions();
        const asset = this.asset();
        if (asset) this.api.getAsset(asset.id).subscribe((a) => this.asset.set(a));
      });
    });
  }

  ngOnInit(): void {
    const asset = this.resume();
    const step = asset ? resumeStep(asset) : null;
    if (!asset || !step) return;
    this.asset.set(asset);
    this.projectNumber.set(asset.connection_setup?.project_number ?? '');
    this.step.set(step);
  }

  loadOptions(): void {
    if (this.optionsState() === 'error') this.optionsState.set('loading');
    forkJoin({ scopes: this.catalogs.connectionOptions('gcp_connection_scope'), methods: this.catalogs.connectionOptions('gcp_setup_method') }).subscribe({
      next: ({ scopes, methods }) => {
        this.scopes.set(scopes);
        this.methods.set(methods);
        // La opción disponible (la recomendada) de cada grupo llega preseleccionada.
        if (!this.scope()) this.scope.set(defaultOption(scopes));
        if (!this.method()) this.method.set(defaultOption(methods));
        this.optionsState.set('ready');
      },
      error: () => this.optionsState.set(this.scopes().length > 0 ? 'ready' : 'error'),
    });
  }

  onNext(): void {
    switch (this.step()) {
      case 'choose':
        this.step.set('project');
        break;
      case 'project':
        this.createAsset();
        break;
      case 'access':
        this.step.set('check');
        break;
      case 'check':
        this.check();
        break;
      case 'result': {
        const asset = this.asset();
        if (asset) this.openConnection.emit(asset);
        break;
      }
    }
  }

  onBack(): void {
    if (this.step() === 'project') this.step.set('choose');
    else if (this.step() === 'check') this.step.set('access');
  }

  private createAsset(): void {
    this.error.set(null);
    this.fieldErrors.set({});
    if (!this.name().trim() || !isGcpProjectId(this.projectId())) {
      this.showHints.set(true);
      return;
    }
    if (this.asset()) {
      this.step.set('access');
      return;
    }
    this.saving.set(true);
    this.api
      .createAsset({
        name: this.name().trim(),
        connection_category: 'ac_01',
        platform: this.platform().code,
        ip_address: null,
        location: null,
        criticality: this.criticality(),
        service_ids: [this.service().id, ...this.extraServiceIds()],
        connection_method: 'identity_federation',
        external_account_id: this.projectId().trim(),
      })
      .subscribe({
        next: (asset) => {
          this.saving.set(false);
          this.asset.set(asset);
          this.step.set('access');
        },
        error: (error) => {
          this.saving.set(false);
          this.showCreateError(error);
        },
      });
  }

  private showCreateError(error: unknown): void {
    const fields = apiFieldErrors(error);
    if (fields.length > 0) {
      this.fieldErrors.set(Object.fromEntries(fields.map((f) => [f.field, f.message])));
      this.error.set(this.translate.instant('TECHNICAL_CONTROL.FORM.CHECK_MARKED'));
      return;
    }
    if (apiErrorCode(error) === 'CONNECTION_METHOD_NOT_APPLICABLE') {
      this.error.set(this.translate.instant('TECHNICAL_CONTROL.FORM.METHOD_NOT_APPLICABLE'));
      return;
    }
    this.error.set(apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.FORM.REGISTER_ERROR')));
  }

  // Guarda el número de proyecto (si cambió) y comprueba el acceso de verdad; al terminar vuelve a leer la conexión, porque la API manda.
  private check(): void {
    const asset = this.asset();
    if (!asset) return;
    this.numberError.set(null);
    this.message.set(null);
    const number = this.projectNumber().trim();
    if (!isGcpProjectNumber(number)) {
      this.numberError.set('TECHNICAL_CONTROL.WIZARD.GCP.CHECK.NUMBER_INVALID');
      return;
    }
    const save: Observable<Asset> = number === asset.connection_setup?.project_number ? of(asset) : this.api.setProjectNumber(asset.id, number);
    this.checking.set(true);
    save.pipe(switchMap((saved) => { this.asset.set(saved); return this.api.validate(asset.id); })).subscribe({
      next: (result) => {
        this.demo.set(result.mode === 'demo');
        this.api.getAsset(asset.id).subscribe({
          next: (fresh) => {
            this.asset.set(fresh);
            this.checking.set(false);
            this.step.set('result');
          },
          error: () => {
            this.checking.set(false);
            this.step.set('result');
          },
        });
      },
      error: (error) => this.showCheckError(error, asset.id),
    });
  }

  private showCheckError(error: unknown, assetId: string): void {
    const fields = apiFieldErrors(error);
    const numberField = fields.find((f) => f.field === 'project_number');
    if (numberField) {
      this.checking.set(false);
      this.message.set({ kind: 'error', text: numberField.message });
      return;
    }
    const code = apiErrorCode(error);
    if (code === 'CONNECTION_FAILED') {
      // La comprobación fallida cambió el estado de la conexión («no pudimos conectar»): se refleja y se dice qué corregir.
      this.message.set({ kind: 'error', text: fields[0]?.message ?? this.translate.instant('TECHNICAL_CONTROL.WIZARD.GCP.CHECK.ACCESS_ERROR') });
      this.api.getAsset(assetId).subscribe({ next: (a) => this.asset.set(a), complete: () => this.checking.set(false), error: () => this.checking.set(false) });
      return;
    }
    this.checking.set(false);
    // «No disponible» no es un error del cliente: el número quedó guardado y puede reintentar en un momento.
    this.message.set({ kind: code === 'CONNECTION_UNAVAILABLE' ? 'info' : 'error', text: apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.PANEL.CHECK_ERROR')) });
  }
}
