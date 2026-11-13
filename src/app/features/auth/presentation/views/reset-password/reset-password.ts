import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorCode, apiErrorMessage } from '@core/domain/utils/api-error';
import { AuthPageLayoutComponent } from '@core/presentation/pages/auth-page-layout/auth-page-layout.component';
import { AuthService } from '@core/domain/services/auth.service';
import { passwordsMatch, STRONG_PASSWORD } from '@shared/domain/utils/password-rules';
import { NewPasswordFields } from '@shared/presentation/components/new-password-fields/new-password-fields';
import { SecondFactorField } from '@shared/presentation/components/second-factor-field/second-factor-field';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';

// Segundo paso de «olvidé mi contraseña» (D101): llega desde el enlace del correo (`?token=`), pide la contraseña nueva y el segundo factor. Todas las sesiones se
// cierran, así que al terminar se manda a iniciar sesión.
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, AuthPageLayoutComponent, NewPasswordFields, SecondFactorField, Busy, BusyFields],
  templateUrl: './reset-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token')?.trim() ?? '';

  readonly loading = signal(false);
  readonly done = signal(false);
  // El enlace no sirve (falta, venció o ya se usó): no hay nada que reintentar aquí, hay que pedir otro.
  readonly linkInvalid = signal(!this.token);
  readonly errorMessage = signal<string | null>(null);

  readonly code = signal('');
  readonly recoveryCode = signal('');
  readonly useRecovery = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.pattern(STRONG_PASSWORD)]],
      password_confirmation: ['', Validators.required],
    },
    { validators: passwordsMatch() },
  );

  readonly factorFilled = computed(() => (this.useRecovery() ? this.recoveryCode().trim().length >= 10 : this.code().trim().length >= 6));

  submit(): void {
    if (this.loading()) return;
    if (this.form.invalid || !this.factorFilled()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    const second = this.useRecovery() ? { recovery_code: this.recoveryCode().trim() } : { code: this.code().trim() };
    this.auth.resetPassword({ token: this.token, new_password: this.form.getRawValue().password, ...second }).subscribe({
      next: () => {
        this.loading.set(false);
        this.done.set(true);
      },
      error: (error) => {
        this.loading.set(false);
        if (apiErrorCode(error) === 'PASSWORD_RESET_INVALID') {
          this.linkInvalid.set(true);
          return;
        }
        // Un código equivocado o una contraseña repetida se corrige aquí mismo; el aviso ya viene traducido.
        this.errorMessage.set(apiErrorMessage(error, this.translate.instant('AUTH.RESET.ERROR_FALLBACK')));
      },
    });
  }
}
