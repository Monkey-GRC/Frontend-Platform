import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { AccessKeyLookup } from '@features/auth/domain/models/auth.models';
import { PasswordToggle } from '@shared/presentation/components/password-toggle/password-toggle';
import { AuthService } from '@features/auth/domain/services/auth.service';

// Política de contraseña del backend (modelo-datos.md §5.3): 12+ con mayúscula, minúscula,
// número y símbolo. Se valida aquí para avisar antes de enviar; el backend la vuelve a exigir.
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('password_confirmation')?.value
    ? null
    : { passwordMismatch: true };

type FieldName = 'code' | 'password' | 'password_confirmation';

// Activación de la cuenta (primer y único uso de la clave de acceso), en dos pasos (D51):
//   1. Solo el código. Con él se muestran la empresa y el correo que Monkey registró.
//   2. Esos datos quedan fijos; lo único que se escribe es la contraseña y su confirmación.
// El administrador se identifica por su correo: no se le pide nombre ni apellido.
@Component({
  selector: 'app-register-form',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, PasswordToggle],
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
  // Lo que Monkey fijó para esta empresa; solo existe en el paso 2.
  readonly lookup = signal<AccessKeyLookup | null>(null);
  readonly loading = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmation = signal(false);
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
    { validators: passwordsMatch },
  );

  hasCodeError(key: string): boolean {
    const control = this.codeForm.get('code');
    return !!control && control.touched && control.hasError(key);
  }

  hasPasswordError(name: 'password' | 'password_confirmation', key: string): boolean {
    const control = this.passwordForm.get(name);
    return !!control && control.touched && control.hasError(key);
  }

  get passwordMismatch(): boolean {
    return (
      !!this.passwordForm.get('password_confirmation')?.touched && this.passwordForm.hasError('passwordMismatch')
    );
  }

  // Paso 1: comprueba el código. No lo gasta: solo trae la empresa y el correo.
  continue(): void {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.serverErrors.set({});

    this.authService.lookupAccessKey(this.codeForm.getRawValue().code.trim()).subscribe({
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

  // Paso 2: crea la cuenta con la contraseña. El correo es el que fijó Monkey, no se edita.
  submit(): void {
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
      .redeem({
        code: this.codeForm.getRawValue().code.trim(),
        email: found.admin_email,
        password: this.passwordForm.getRawValue().password,
      })
      .subscribe({
        next: (outcome) => {
          this.loading.set(false);
          if (outcome.kind === 'mfa') {
            this.router.navigateByUrl('/mfa', { replaceUrl: true });
            return;
          }
          const payload = outcome.payload;
          // Quien aún no ha contado de qué trata su empresa empieza por ahí; el resto, por el inicio.
          this.router.navigateByUrl(payload.onboarding?.next_step === 'organizational_context' ? '/onboarding' : '/', { replaceUrl: true });
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
