import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogOption, ConnectionOption } from '@shared/domain/models/catalog.models';
import { Asset, NewAssetInput, Platform } from '@shared/domain/models/technical-control.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { resumeStep } from '@shared/domain/utils/connection-resume';
import { LeaveMode } from '@features/technical-control/domain/services/wizard-leave.service';
import { defaultOption, isSelectable } from '@features/technical-control/domain/utils/connection-options';
import { isAwsAccountId } from '@features/technical-control/domain/utils/aws-validation';
import { AwsAccessStep } from '../aws-access-step/aws-access-step';
import { AwsAccountStep } from '../aws-account-step/aws-account-step';
import { AwsCheckStep } from '../aws-check-step/aws-check-step';
import { AwsChooseStep } from '../aws-choose-step/aws-choose-step';
import { OptionsLoadState } from '../connection-options-state/connection-options-state';
import { CONNECTION_STEPS, ConnectionWizardShell } from '../connection-wizard-shell/connection-wizard-shell';
import { ConnectionResultStep } from '../connection-result-step/connection-result-step';

// Las dos formas de dar acceso que este recorrido sabe seguir; cuáles ofrece la plataforma y con qué texto lo dice el catálogo.
type AwsMethod = 'readonly_role' | 'access_keys';
const isAwsMethod = (value: string | null): value is AwsMethod => value === 'readonly_role' || value === 'access_keys';

type Step = 'choose' | 'account' | 'access' | 'check' | 'result';

// El recorrido de AWS (D58, D67): elegir cómo → datos de la cuenta → dar acceso → comprobar → resultado. Una cosa por pantalla.
// Con el rol (recomendado) el activo nace al terminar los datos, porque ahí Monkey genera lo que el cliente pega en su cuenta; con llaves nace al darlas, porque viajan en el alta.
// Una vez creado el activo no se vuelve a «datos» (editarlos se hace desde la conexión). Con `resume` el asistente se reabre en el paso que toca para un activo que quedó a medias.
const STEPS: readonly Step[] = ['choose', 'account', 'access', 'check', 'result'];
const NEXT_LABEL: Record<Step, string> = {
  choose: 'TECHNICAL_CONTROL.WIZARD.NEXT',
  account: 'TECHNICAL_CONTROL.WIZARD.NEXT',
  access: 'TECHNICAL_CONTROL.WIZARD.NEXT',
  check: 'TECHNICAL_CONTROL.CARD.CHECK_CONNECTION',
  result: 'TECHNICAL_CONTROL.WIZARD.RESULT.OPEN',
};

@Component({
  selector: 'app-aws-connection-flow',
  imports: [ConnectionWizardShell, AwsChooseStep, AwsAccountStep, AwsAccessStep, AwsCheckStep, ConnectionResultStep],
  templateUrl: './aws-connection-flow.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AwsConnectionFlow implements OnInit {
  private readonly api = inject(TechnicalControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly platform = input.required<Platform>();
  readonly service = input.required<{ id: string; name: string }>();
  readonly otherServices = input<{ id: string; name: string }[]>([]);
  readonly criticalities = input<CatalogOption[]>([]);
  // Un activo a medias que se retoma.
  readonly resume = input<Asset | null>(null);

  readonly closed = output<void>();
  readonly openConnection = output<Asset>();

  protected readonly steps = CONNECTION_STEPS;
  readonly step = signal<Step>('choose');
  readonly current = computed(() => STEPS.indexOf(this.step()) + 1);

  // Las formas de dar acceso (con su disponibilidad y sus etiquetas) las sirve el backend; la plataforma dice cuáles son suyas (D114).
  readonly optionsState = signal<OptionsLoadState>('loading');
  readonly allMethods = signal<ConnectionOption[]>([]);
  readonly methods = computed(() => this.allMethods().filter((o) => this.platform().connection_methods.some((m) => m === o.value)));
  readonly method = signal<AwsMethod | null>(null);

  readonly accountId = signal('');
  readonly regions = signal<string[]>([]);
  readonly name = signal('');
  readonly criticality = signal('medium');
  readonly extraServiceIds = signal<string[]>([]);
  readonly accessKeyId = signal('');
  readonly secretAccessKey = signal('');
  readonly regionOptions = signal<CatalogOption[]>([]);
  readonly showHints = signal(false);
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly error = signal<string | null>(null);

  readonly asset = signal<Asset | null>(null);
  readonly roleArn = signal('');
  readonly roleError = signal<string | null>(null);
  readonly message = signal<{ kind: 'error' | 'info'; text: string } | null>(null);
  readonly demo = signal(false);
  readonly saving = signal(false);
  readonly checking = signal(false);

  readonly leaveMode = computed<LeaveMode>(() => (this.step() === 'result' ? 'none' : this.asset() ? 'saved' : this.step() === 'choose' ? 'none' : 'discard'));
  readonly busy = computed(() => this.saving() || this.checking());
  readonly setup = computed(() => this.asset()?.connection_setup ?? null);
  readonly isRole = computed(() => this.method() !== 'access_keys');
  readonly showBack = computed(() => {
    switch (this.step()) {
      case 'account':
        return true;
      case 'access':
        return !this.asset();
      case 'check':
        return this.isRole();
      default:
        return false;
    }
  });
  readonly nextLabelKey = computed(() => {
    const step = this.step();
    if (step === 'check' && this.message()?.kind === 'error') return 'TECHNICAL_CONTROL.CARD.CHECK_AGAIN';
    return step === 'access' && this.isRole() ? 'TECHNICAL_CONTROL.WIZARD.AWS.ACCESS.DONE' : NEXT_LABEL[step];
  });
  readonly nextDisabled = computed(() => {
    switch (this.step()) {
      case 'choose':
        return this.optionsState() !== 'ready' || !isSelectable(this.methods(), this.method());
      case 'access':
        return this.isRole() && !this.setup()?.monkey_principal_arn;
      default:
        return false;
    }
  });

  constructor() {
    // El backend traduce las regiones y los pasos de la conexión: al cambiar el idioma se vuelven a pedir, sin tocar lo que el cliente ya escribió.
    effect(() => {
      this.language.current();
      untracked(() => {
        this.loadOptions();
        this.catalogs.options(`${this.platform().code}_region`).subscribe((o) => this.regionOptions.set(o));
        const asset = this.asset();
        if (asset) this.api.getAsset(asset.id).subscribe((a) => this.asset.set(a));
      });
    });
  }

  ngOnInit(): void {
    const asset = this.resume();
    const step = asset ? resumeStep(asset) : null;
    if (asset && step) {
      this.asset.set(asset);
      this.method.set(asset.provisioning.connection_method === 'access_keys' ? 'access_keys' : 'readonly_role');
      this.roleArn.set(asset.connection_setup?.role_arn ?? '');
      this.step.set(step);
    }
  }

  loadOptions(): void {
    if (this.optionsState() === 'error') this.optionsState.set('loading');
    this.catalogs.connectionOptions('connection_method').subscribe({
      next: (options) => {
        this.allMethods.set(options);
        // La opción recomendada que se pueda elegir llega preseleccionada (salvo al retomar una conexión, que ya tiene la suya).
        const preselected = defaultOption(this.methods());
        if (!this.method() && isAwsMethod(preselected)) this.method.set(preselected);
        this.optionsState.set('ready');
      },
      error: () => this.optionsState.set(this.allMethods().length > 0 ? 'ready' : 'error'),
    });
  }

  chooseMethod(value: string): void {
    if (isAwsMethod(value)) this.method.set(value);
  }

  onNext(): void {
    switch (this.step()) {
      case 'choose':
        this.step.set('account');
        break;
      case 'account':
        this.fromAccount();
        break;
      case 'access':
        this.fromAccess();
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
    if (this.step() === 'account') this.step.set('choose');
    else if (this.step() === 'access') this.step.set('account');
    else if (this.step() === 'check') this.step.set('access');
  }

  private fromAccount(): void {
    this.error.set(null);
    this.fieldErrors.set({});
    if (!this.name().trim() || !isAwsAccountId(this.accountId()) || this.regions().length === 0) {
      this.showHints.set(true);
      return;
    }
    if (this.isRole() && !this.asset()) this.createAsset();
    else this.step.set('access');
  }

  private fromAccess(): void {
    this.error.set(null);
    this.fieldErrors.set({});
    if (this.isRole()) {
      this.step.set('check');
      return;
    }
    if (!this.accessKeyId().trim() || !this.secretAccessKey().trim()) {
      this.showHints.set(true);
      return;
    }
    if (this.asset()) this.step.set('check');
    else this.createAsset();
  }

  private createAsset(): void {
    const method = this.method();
    if (!method) return;
    const input: NewAssetInput = {
      name: this.name().trim(),
      connection_category: 'ac_01',
      platform: this.platform().code,
      ip_address: null,
      location: null,
      criticality: this.criticality(),
      service_ids: [this.service().id, ...this.extraServiceIds()],
      connection_method: method,
      external_account_id: this.accountId().trim(),
      regions: this.regions(),
      // Las llaves solo viajan aquí, se guardan cifradas y no se vuelven a mostrar.
      ...(method === 'access_keys' ? { credentials: { access_key_id: this.accessKeyId().trim(), secret_access_key: this.secretAccessKey().trim() } } : {}),
    };
    this.saving.set(true);
    this.api.createAsset(input).subscribe({
      next: (asset) => {
        this.saving.set(false);
        this.asset.set(asset);
        // Las llaves ya viajaron: no se conservan en pantalla.
        this.accessKeyId.set('');
        this.secretAccessKey.set('');
        this.step.set(method === 'access_keys' ? 'check' : 'access');
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
      const map = Object.fromEntries(fields.map((f) => [f.field.replace(/^credentials\./, ''), f.message]));
      this.fieldErrors.set(map);
      this.error.set(this.translate.instant('TECHNICAL_CONTROL.FORM.CHECK_MARKED'));
      // Un dato de «datos» mal escrito: se vuelve a ese paso para corregirlo.
      if (['name', 'external_account_id', 'regions'].some((k) => k in map)) this.step.set('account');
      return;
    }
    if (apiErrorCode(error) === 'CONNECTION_METHOD_NOT_APPLICABLE') {
      this.error.set(this.translate.instant('TECHNICAL_CONTROL.FORM.METHOD_NOT_APPLICABLE'));
      return;
    }
    this.error.set(apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.FORM.REGISTER_ERROR')));
  }

  // Con el rol guarda el ARN (si cambió) y comprueba el acceso de verdad; con llaves, solo comprueba. Al terminar vuelve a leer la conexión, porque la API manda.
  private check(): void {
    const asset = this.asset();
    if (!asset) return;
    this.roleError.set(null);
    this.message.set(null);
    let save: Observable<Asset> = of(asset);
    if (this.isRole()) {
      const arn = this.roleArn().trim();
      if (!arn) {
        this.roleError.set('TECHNICAL_CONTROL.PANEL.ROLE_REQUIRED');
        return;
      }
      if (arn !== asset.connection_setup?.role_arn) save = this.api.setRoleArn(asset.id, arn);
    }
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
    const roleField = fields.find((f) => f.field === 'role_arn');
    const code = apiErrorCode(error);
    if (roleField && code !== 'CONNECTION_FAILED') {
      this.checking.set(false);
      this.message.set({ kind: 'error', text: roleField.message });
      return;
    }
    if (code === 'CONNECTION_FAILED') {
      // La comprobación fallida cambió el estado de la conexión («no pudimos conectar»): se refleja y se dice qué corregir.
      this.message.set({ kind: 'error', text: roleField?.message ?? fields[0]?.message ?? this.translate.instant('TECHNICAL_CONTROL.PANEL.ACCESS_ERROR') });
      this.api.getAsset(assetId).subscribe({ next: (a) => this.asset.set(a), complete: () => this.checking.set(false), error: () => this.checking.set(false) });
      return;
    }
    this.checking.set(false);
    // «No disponible» no es un error del cliente: lo guardado queda y puede reintentar en un momento.
    this.message.set({ kind: code === 'CONNECTION_UNAVAILABLE' ? 'info' : 'error', text: apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.PANEL.CHECK_ERROR')) });
  }
}
