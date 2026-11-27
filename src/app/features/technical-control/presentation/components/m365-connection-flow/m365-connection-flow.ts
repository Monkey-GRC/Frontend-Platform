import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { Asset, Platform } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { resumeStep } from '@shared/domain/utils/connection-resume';
import { StepperItem } from '@shared/presentation/components/stepper/stepper';
import { LeaveMode } from '@features/technical-control/domain/services/wizard-leave.service';
import { ExternalNavigation } from '@features/technical-control/domain/services/external-navigation.service';
import { microsoftReturnErrorKey, MICROSOFT_ERROR_PARAM } from '@features/technical-control/domain/utils/microsoft-return';
import { CONNECTION_STEPS, ConnectionWizardShell } from '../connection-wizard-shell/connection-wizard-shell';
import { ConnectionResultStep } from '../connection-result-step/connection-result-step';
import { M365AccessStep } from '../m365-access-step/m365-access-step';
import { M365CheckState, M365CheckStep } from '../m365-check-step/m365-check-step';
import { M365DataStep } from '../m365-data-step/m365-data-step';
import { M365MailAccessGuide } from '../m365-mail-access-guide/m365-mail-access-guide';

type Step = 'data' | 'access' | 'check' | 'result';
const STEPS: readonly Step[] = ['data', 'access', 'check', 'result'];
const NEXT_LABEL: Record<Step, string> = {
  data: 'TECHNICAL_CONTROL.WIZARD.NEXT',
  access: 'TECHNICAL_CONTROL.WIZARD.M365.ACCESS.BUTTON',
  check: 'TECHNICAL_CONTROL.CARD.CHECK_AGAIN',
  result: 'TECHNICAL_CONTROL.WIZARD.RESULT.OPEN',
};
/** Justo después de autorizar, Microsoft puede tardar en aplicar los permisos: se reintenta solo antes de molestar al cliente. */
export const CHECK_ATTEMPTS = 4;
export const CHECK_RETRY_MS = 15_000;

// «Conectar Microsoft 365» (D157). Un solo recorrido sin nada que copiar: datos (aquí nace la conexión) → autorizar en Microsoft (se sale de la app y se vuelve por
// `/integraciones/microsoft`) → comprobar, que empieza solo al volver → resultado, con la guía opcional para el correo. No hay pantalla de «cómo conectar»: hay una sola forma.
@Component({
  selector: 'app-m365-connection-flow',
  imports: [ConnectionWizardShell, ConnectionResultStep, M365DataStep, M365AccessStep, M365CheckStep, M365MailAccessGuide],
  templateUrl: './m365-connection-flow.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class M365ConnectionFlow implements OnInit, OnDestroy {
  private readonly api = inject(TechnicalControlService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly external = inject(ExternalNavigation);
  private readonly route = inject(ActivatedRoute);

  readonly platform = input.required<Platform>();
  readonly service = input.required<{ id: string; name: string }>();
  readonly otherServices = input<{ id: string; name: string }[]>([]);
  readonly criticalities = input<CatalogOption[]>([]);
  readonly resume = input<Asset | null>(null);

  readonly closed = output<void>();
  readonly openConnection = output<Asset>();

  // El recorrido de siempre, sin el primer paso («cómo conectar»).
  protected readonly steps: StepperItem[] = CONNECTION_STEPS.slice(1);
  readonly step = signal<Step>('data');
  readonly current = computed(() => STEPS.indexOf(this.step()) + 1);

  readonly name = signal('');
  readonly criticality = signal('medium');
  readonly extraServiceIds = signal<string[]>([]);
  readonly showHints = signal(false);
  readonly error = signal<string | null>(null);

  readonly asset = signal<Asset | null>(null);
  readonly returnErrorKey = signal<string | null>(null);
  readonly checkState = signal<M365CheckState>('checking');
  readonly attempt = signal(1);
  protected readonly attempts = CHECK_ATTEMPTS;
  readonly checkMessage = signal<string | null>(null);
  readonly demo = signal(false);
  /** Creando la conexión o saliendo hacia Microsoft. */
  readonly saving = signal(false);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Subscription | null = null;

  readonly steps$ = computed(() => this.asset()?.connection_setup?.steps ?? []);
  readonly leaveMode = computed<LeaveMode>(() => (this.step() === 'result' ? 'none' : this.asset() ? 'saved' : 'none'));
  readonly busy = computed(() => this.saving() || (this.step() === 'check' && this.checkState() !== 'failed'));
  readonly nextLabelKey = computed(() => NEXT_LABEL[this.step()]);
  readonly showBack = computed(() => this.step() === 'check' && this.checkState() === 'failed');
  readonly showNext = computed(() => this.step() !== 'check' || this.checkState() === 'failed');

  constructor() {
    // Los pasos los traduce el backend: al cambiar el idioma se vuelve a leer la conexión.
    effect(() => {
      this.language.current();
      untracked(() => {
        const asset = this.asset();
        if (asset) this.api.getAsset(asset.id).subscribe((a) => this.asset.set(a));
      });
    });
  }

  ngOnInit(): void {
    this.returnErrorKey.set(microsoftReturnErrorKey(this.route.snapshot?.queryParamMap.get(MICROSOFT_ERROR_PARAM) ?? null));
    const asset = this.resume();
    const step = asset ? resumeStep(asset) : null;
    if (!asset || !step) return;
    this.asset.set(asset);
    this.step.set(step);
    // Volvió autorizado: se comprueba sin pedirle nada más.
    if (step === 'check') this.startCheck();
  }

  ngOnDestroy(): void {
    this.stopCheck();
  }

  onNext(): void {
    switch (this.step()) {
      case 'data':
        this.createAsset();
        break;
      case 'access':
        this.signIn();
        break;
      case 'check':
        this.startCheck();
        break;
      case 'result': {
        const asset = this.asset();
        if (asset) this.openConnection.emit(asset);
        break;
      }
    }
  }

  /** Desde una comprobación fallida: volver a autorizar. */
  onBack(): void {
    this.stopCheck();
    this.returnErrorKey.set(null);
    this.step.set('access');
  }

  private createAsset(): void {
    this.error.set(null);
    if (!this.name().trim()) {
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
        connection_method: 'admin_consent',
      })
      .subscribe({
        next: (asset) => {
          this.saving.set(false);
          this.asset.set(asset);
          this.step.set('access');
        },
        error: (error) => {
          this.saving.set(false);
          const field = apiFieldErrors(error)[0]?.message;
          this.error.set(field ?? apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.FORM.REGISTER_ERROR')));
        },
      });
  }

  private signIn(): void {
    const asset = this.asset();
    if (!asset) return;
    this.error.set(null);
    this.returnErrorKey.set(null);
    this.saving.set(true);
    this.api.startMicrosoftConsent(asset.id).subscribe({
      // Sigue «ocupado» a propósito: la página se va hacia Microsoft y el botón no debe poder pulsarse otra vez.
      next: ({ authorize_url }) => {
        if (this.external.toMicrosoft(authorize_url)) return;
        this.saving.set(false);
        this.error.set(this.translate.instant('TECHNICAL_CONTROL.WIZARD.M365.ACCESS.START_ERROR'));
      },
      error: (error) => {
        this.saving.set(false);
        this.error.set(
          apiErrorCode(error) === 'CONNECTION_UNAVAILABLE'
            ? this.translate.instant('TECHNICAL_CONTROL.WIZARD.M365.ACCESS.UNAVAILABLE')
            : apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.WIZARD.M365.ACCESS.START_ERROR')),
        );
      },
    });
  }

  private startCheck(): void {
    this.stopCheck();
    this.step.set('check');
    this.attempt.set(1);
    this.checkMessage.set(null);
    this.check();
  }

  private check(): void {
    const asset = this.asset();
    if (!asset) return;
    this.checkState.set('checking');
    this.pending = this.api.validate(asset.id).subscribe({
      next: (result) => {
        this.demo.set(result.mode === 'demo');
        this.pending = this.api.getAsset(asset.id).subscribe({
          next: (fresh) => {
            this.asset.set(fresh);
            this.step.set('result');
          },
          error: () => this.step.set('result'),
        });
      },
      error: (error) => this.onCheckError(error),
    });
  }

  private onCheckError(error: unknown): void {
    const waitingForMicrosoft = apiFieldErrors(error).some((f) => f.field === 'consent');
    if (waitingForMicrosoft && this.attempt() < CHECK_ATTEMPTS) {
      this.checkState.set('waiting');
      this.timer = setTimeout(() => {
        this.attempt.update((n) => n + 1);
        this.check();
      }, CHECK_RETRY_MS);
      return;
    }
    this.checkState.set('failed');
    this.checkMessage.set(apiFieldErrors(error)[0]?.message ?? apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.PANEL.CHECK_ERROR')));
  }

  private stopCheck(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending?.unsubscribe();
    this.pending = null;
  }
}
