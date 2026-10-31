import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { apiErrorCode, apiErrorMessage } from '@core/domain/utils/api-error';
import { AuthPayload, MfaSetupStart } from '@features/auth/domain/models/auth.models';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { CodeInput } from '@shared/presentation/components/code-input/code-input';
import { Stepper, StepperItem } from '@shared/presentation/components/stepper/stepper';
import { QrCode } from '@shared/presentation/components/qr-code/qr-code';

// Segundo factor (D94, contracts/modules/auth.md). Una sola pantalla con dos recorridos:
//   · Quien ya tiene el factor: escribe el código de su app, o uno de recuperación (verify → recovery).
//   · Quien debe configurarlo (primer ingreso): instalar la app → escanear el QR → confirmar el primer código → guardar los códigos de recuperación.
type Stage = 'verify' | 'recovery' | 'install' | 'scan' | 'confirm' | 'codes';

@Component({
  selector: 'app-mfa-form',
  imports: [ReactiveFormsModule, TranslatePipe, CodeInput, QrCode, Stepper],
  templateUrl: './mfa-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaForm {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  private readonly codeInput = viewChild(CodeInput);

  readonly stage = signal<Stage>('verify');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  // El desafío (5 min) venció o se agotó: no hay nada que reintentar aquí, hay que volver a iniciar sesión.
  readonly expired = signal(false);
  readonly code = signal('');
  readonly recovery = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] });

  readonly setup = signal<MfaSetupStart | null>(null);
  readonly recoveryCodes = signal<string[]>([]);
  readonly saved = signal(false);
  readonly copied = signal<'key' | 'codes' | null>(null);
  // La sesión ya está abierta en el servidor, pero no se guarda aquí hasta que la persona confirme que guardó sus códigos.
  private confirmedPayload: AuthPayload | null = null;

  // El QR y la clave manual no se dibujan hasta que la persona los pide (clic en el recuadro).
  readonly qrRevealed = signal(false);

  readonly steps: StepperItem[] = [
    { icon: 'phone_android', label: 'AUTH.MFA.STEP_INSTALL' },
    { icon: 'qr_code_scanner', label: 'AUTH.MFA.STEP_SCAN' },
    { icon: 'pin', label: 'AUTH.MFA.STEP_CONFIRM' },
    { icon: 'key', label: 'AUTH.MFA.STEP_CODES' },
  ];

  constructor() {
    const pending = this.auth.pendingMfa();
    if (!pending) {
      this.router.navigateByUrl('/signin', { replaceUrl: true });
      return;
    }
    this.stage.set(pending.next_step === 'mfa_verify' ? 'verify' : 'install');
  }

  /** Posición del paso a paso de la configuración (1 a 4), o 0 si no está configurando. */
  get setupStep(): number {
    switch (this.stage()) {
      case 'install':
        return 1;
      case 'scan':
        return 2;
      case 'confirm':
        return 3;
      case 'codes':
        return 4;
      default:
        return 0;
    }
  }

  // Ingreso: el código de 6 dígitos de la app.
  submitCode(code: string): void {
    if (this.loading()) return;
    const stage = this.stage();
    if (stage === 'verify') {
      this.run(this.auth.verifyMfa({ code }), (payload) => this.enter(payload));
    } else if (stage === 'confirm') {
      this.run(this.auth.confirmMfaSetup(code), (payload) => {
        this.confirmedPayload = payload;
        this.recoveryCodes.set(payload.recovery_codes ?? []);
        this.stage.set('codes');
      });
    }
  }

  submitRecovery(): void {
    if (this.loading()) return;
    if (this.recovery.invalid) {
      this.recovery.markAsTouched();
      return;
    }
    this.run(this.auth.verifyMfa({ recovery_code: this.recovery.value.trim() }), (payload) => this.enter(payload));
  }

  showRecovery(): void {
    this.errorMessage.set(null);
    this.stage.set('recovery');
  }

  showCode(): void {
    this.errorMessage.set(null);
    this.stage.set('verify');
  }

  // Configuración, paso 1 → 2: pide el secreto y dibuja el QR.
  startSetup(): void {
    if (this.loading()) return;
    this.run(this.auth.startMfaSetup(), (setup) => {
      this.setup.set(setup);
      this.qrRevealed.set(false);
      this.stage.set('scan');
    });
  }

  toConfirm(): void {
    this.qrRevealed.set(false);
    this.errorMessage.set(null);
    this.stage.set('confirm');
  }

  backToScan(): void {
    this.errorMessage.set(null);
    this.code.set('');
    this.qrRevealed.set(false);
    this.stage.set('scan');
  }

  async copy(text: string, what: 'key' | 'codes'): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(what);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      // Sin permiso para el portapapeles: la persona puede seleccionar y copiar a mano.
    }
  }

  download(): void {
    const header = this.translate.instant('AUTH.MFA.CODES_FILE_HEADER');
    const blob = new Blob([`${header}\n\n${this.recoveryCodes().join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'monkey-codigos-de-recuperacion.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  finish(): void {
    if (!this.saved() || !this.confirmedPayload || this.loading()) return;
    this.run(this.auth.finishMfaSetup(this.confirmedPayload), (payload) => this.navigateIn(payload));
  }

  backToLogin(): void {
    this.auth.pendingMfa.set(null);
    this.router.navigateByUrl('/signin', { replaceUrl: true });
  }

  private enter(payload: AuthPayload): void {
    this.navigateIn(payload);
  }

  private navigateIn(payload: AuthPayload): void {
    // Quien aún no ha contado de qué trata su empresa empieza por ahí; el resto, por el inicio.
    this.router.navigateByUrl(payload.onboarding?.next_step === 'organizational_context' ? '/onboarding' : '/', { replaceUrl: true });
  }

  private run<T>(request: Observable<T>,onSuccess: (value: T) => void): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    request.subscribe({
      next: (value) => {
        this.loading.set(false);
        onSuccess(value);
      },
      error: (error) => {
        this.loading.set(false);
        this.code.set('');
        if (apiErrorCode(error) === 'MFA_CHALLENGE_INVALID') this.expired.set(true);
        this.errorMessage.set(apiErrorMessage(error, this.translate.instant('AUTH.MFA.ERROR_FALLBACK')));
        queueMicrotask(() => this.codeInput()?.focus());
      },
    });
  }
}
