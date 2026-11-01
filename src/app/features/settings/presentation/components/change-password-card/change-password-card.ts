import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SessionService } from '@core/domain/services/session.service';
import { apiErrorCode, apiErrorMessage } from '@core/domain/utils/api-error';
import { differentFromCurrent, passwordsMatch, STRONG_PASSWORD } from '@shared/domain/utils/password-rules';
import { NoticeDialog } from '@shared/presentation/components/notice-dialog/notice-dialog';
import { NewPasswordFields } from '@shared/presentation/components/new-password-fields/new-password-fields';
import { PasswordField } from '@shared/presentation/components/password-field/password-field';
import { SecondFactorAnswer, SecondFactorDialog } from '@shared/presentation/components/second-factor-dialog/second-factor-dialog';
import { SecurityService } from '../../../domain/services/security.service';

// Un código equivocado se corrige en el mismo modal; cualquier otro error (la contraseña actual, una repetida, demasiados cambios) manda a la persona de vuelta al formulario.
const STAYS_IN_DIALOG = new Set(['MFA_CODE_INVALID', 'ACCOUNT_LOCKED']);

// Cambiar la contraseña cuando la persona quiera (D101; no vence por calendario). Ella llena la actual y la nueva (con su guía); cuando todo está bien, un modal pide el código
// del segundo factor y recién entonces se envía.
@Component({
  selector: 'app-change-password-card',
  imports: [ReactiveFormsModule, TranslatePipe, NewPasswordFields, NoticeDialog, PasswordField, SecondFactorDialog],
  templateUrl: './change-password-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordCard {
  private readonly fb = inject(FormBuilder);
  private readonly security = inject(SecurityService);
  private readonly translate = inject(TranslateService);
  private readonly session = inject(SessionService);

  readonly loading = signal(false);
  readonly done = signal(false);
  readonly confirming = signal(false);
  // El error que se muestra en el formulario y el que se muestra dentro del modal.
  readonly errorMessage = signal<string | null>(null);
  readonly dialogError = signal<string | null>(null);
  // «¿No la recuerdas?»: con la sesión abierta ya se sabe el correo, así que no se manda a otra pantalla; se envía el enlace y un aviso dice a dónde.
  readonly recovering = signal(false);
  readonly recoveryError = signal<string | null>(null);
  readonly recoverySentTo = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      current_password: ['', Validators.required],
      password: ['', [Validators.required, Validators.pattern(STRONG_PASSWORD)]],
      password_confirmation: ['', Validators.required],
    },
    { validators: [passwordsMatch(), differentFromCurrent()] },
  );

  /** Envía el enlace de recuperación al correo de la persona en sesión y se lo avisa. */
  recoverByEmail(): void {
    const email = this.session.user()?.email;
    if (this.recovering() || !email) return;
    this.recovering.set(true);
    this.recoveryError.set(null);
    this.security.requestPasswordRecovery(email).subscribe({
      next: () => {
        this.recovering.set(false);
        this.recoverySentTo.set(email);
      },
      error: (error) => {
        this.recovering.set(false);
        this.recoveryError.set(apiErrorMessage(error, this.translate.instant('SETTINGS.SECURITY.PASSWORD.RECOVER.ERROR')));
      },
    });
  }

  /** «Cambiar contraseña»: si todo está bien abre el modal del código; todavía no envía nada. */
  requestChange(): void {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set(null);
    this.dialogError.set(null);
    this.done.set(false);
    this.confirming.set(true);
  }

  cancelConfirmation(): void {
    if (this.loading()) return;
    this.confirming.set(false);
    this.dialogError.set(null);
  }

  confirmChange(factor: SecondFactorAnswer): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.dialogError.set(null);
    const { current_password, password } = this.form.getRawValue();
    this.security.changePassword({ current_password, new_password: password, ...factor }).subscribe({
      next: () => {
        this.loading.set(false);
        this.confirming.set(false);
        this.done.set(true);
        this.form.reset();
      },
      error: (error) => {
        this.loading.set(false);
        // El aviso ya viene traducido por el backend.
        const message = apiErrorMessage(error, this.translate.instant('SETTINGS.SECURITY.PASSWORD.ERROR_FALLBACK'));
        if (STAYS_IN_DIALOG.has(apiErrorCode(error) ?? '')) {
          this.dialogError.set(message);
        } else {
          this.confirming.set(false);
          this.errorMessage.set(message);
        }
      },
    });
  }
}
