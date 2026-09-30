import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { AuthService } from '@features/auth/domain/services/auth.service';

// Política de contraseña del backend (modelo-datos.md §5.3): 12+ con mayúscula, minúscula,
// número y símbolo. Se valida aquí para avisar antes de enviar; el backend la vuelve a exigir.
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('password_confirmation')?.value
    ? null
    : { passwordMismatch: true };

type FieldName = 'code' | 'email' | 'name' | 'last_name' | 'password' | 'password_confirmation';

// Activación de la cuenta (primer y único uso de la clave de acceso). Crea la cuenta del
// administrador de la empresa; desde ahí se entra siempre con correo y contraseña.
@Component({
  selector: 'app-register-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-form.html',
  styleUrl: './register-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterForm {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  // Errores por campo que devuelve el backend (422), para mostrarlos bajo cada input.
  readonly serverErrors = signal<Partial<Record<FieldName, string>>>({});

  readonly form = this.fb.nonNullable.group(
    {
      code: ['', [Validators.required, Validators.maxLength(32)]],
      email: ['', [Validators.required, Validators.email]],
      name: ['', [Validators.required, Validators.maxLength(100)]],
      last_name: ['', [Validators.required, Validators.maxLength(100)]],
      password: ['', [Validators.required, Validators.pattern(STRONG_PASSWORD)]],
      password_confirmation: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  hasError(name: FieldName, key: string): boolean {
    const control = this.form.get(name);
    return !!control && control.touched && control.hasError(key);
  }

  get passwordMismatch(): boolean {
    return !!this.form.get('password_confirmation')?.touched && this.form.hasError('passwordMismatch');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.serverErrors.set({});

    const { code, email, name, last_name, password } = this.form.getRawValue();
    this.authService
      .redeem({
        code: code.trim(),
        email: email.trim().toLowerCase(),
        name: name.trim(),
        last_name: last_name.trim(),
        password,
      })
      .subscribe({
        next: (payload) => {
          this.loading.set(false);
          // Quien aún no ha contado de qué trata su empresa empieza por ahí; el resto, por el inicio.
          this.router.navigateByUrl(payload.onboarding?.next_step === 'organizational_context' ? '/onboarding' : '/');
        },
        error: (error) => {
          this.loading.set(false);
          const fields = apiFieldErrors(error);
          this.serverErrors.set(
            Object.fromEntries(fields.map((f) => [f.field, f.message])) as Partial<Record<FieldName, string>>,
          );
          this.errorMessage.set(
            apiErrorMessage(error, 'No se pudo activar la cuenta. Intenta de nuevo.'),
          );
        },
      });
  }
}
