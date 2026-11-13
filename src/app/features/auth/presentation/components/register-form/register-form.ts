import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CodeLookup } from '@core/domain/models/auth.models';
import { passwordsMatch, STRONG_PASSWORD } from '@shared/domain/utils/password-rules';
import { NewPasswordFields } from '@shared/presentation/components/new-password-fields/new-password-fields';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';
import { AuthService } from '@core/domain/services/auth.service';
import { postLoginPath } from '@core/domain/utils/post-login-path';

type FieldName = 'code' | 'password' | 'password_confirmation';

// Activación de la cuenta (primer y único uso del código), en dos pasos (D51):
//   1. Solo el código. Sirve el de la empresa (clave de acceso de su primer administrador) o el que el administrador entregó a una persona de su equipo (D96).
//      Con él se muestran el correo fijado y, si es la clave de una empresa, la empresa.
//   2. Esos datos quedan fijos; lo único que se escribe es la contraseña y su confirmación.
// La cuenta se identifica por su correo: no se pide nombre ni apellido.
@Component({
  selector: 'app-register-form',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, NewPasswordFields, Busy, BusyFields],
  templateUrl: './register-form.html',
  styleUrl: './register-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterForm {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly step = signal<1 | 2>(1);
  // Lo que se fijó para esta cuenta; solo existe en el paso 2.
  readonly lookup = signal<CodeLookup | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  // Errores por campo que devuelve el backend (422), para mostrarlos bajo cada input.
  readonly serverErrors = signal<Partial<Record<FieldName, string>>>({});

  readonly codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(32)]],
  });

  readonly passwordForm = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.pattern(STRONG_PASSWORD)]],
      password_confirmation: ['', Validators.required],
    },
    { validators: passwordsMatch() },
  );

  hasCodeError(key: string): boolean {
    const control = this.codeForm.get('code');
    return !!control && control.touched && control.hasError(key);
  }

  // Paso 1: comprueba el código. No lo gasta: solo trae la empresa y el correo.
  continue(): void {
    if (this.loading()) return;
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.serverErrors.set({});

    this.authService.lookupCode(this.codeForm.getRawValue().code.trim()).subscribe({
      next: (found) => {
        this.loading.set(false);
        this.lookup.set(found);
        this.step.set(2);
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(apiErrorMessage(error, this.translate.instant('AUTH.REGISTER.ERROR_LOOKUP')));
      },
    });
  }

  // Volver al paso 1 para corregir el código.
  changeCode(): void {
    this.lookup.set(null);
    this.passwordForm.reset();
    this.errorMessage.set(null);
    this.serverErrors.set({});
    this.step.set(1);
  }

  // Paso 2: crea la cuenta con la contraseña. El correo es el que quedó fijado, no se edita.
  submit(): void {
    if (this.loading()) return;
    const found = this.lookup();
    if (!found) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.serverErrors.set({});

    this.authService
      .claimAccount(found, this.codeForm.getRawValue().code.trim(), this.passwordForm.getRawValue().password)
      .subscribe({
        next: (outcome) => {
          // Ocupado hasta que termina la navegación (D116).
          const url = outcome.kind === 'mfa' ? '/mfa' : postLoginPath(outcome.payload.user.role, outcome.payload.onboarding);
          this.router.navigateByUrl(url, { replaceUrl: true }).then(
            () => this.loading.set(false),
            () => this.loading.set(false),
          );
        },
        error: (error) => {
          this.loading.set(false);
          const fields = apiFieldErrors(error);
          this.serverErrors.set(
            Object.fromEntries(fields.map((f) => [f.field, f.message])) as Partial<Record<FieldName, string>>,
          );
          this.errorMessage.set(
            apiErrorMessage(error, this.translate.instant('AUTH.REGISTER.ERROR_ACTIVATE')),
          );
        },
      });
  }
}
