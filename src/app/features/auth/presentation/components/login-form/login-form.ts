import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { PasswordToggle } from '@shared/presentation/components/password-toggle/password-toggle';

@Component({
  selector: 'app-login-form',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, PasswordToggle],
  templateUrl: './login-form.html',
  styleUrl: './login-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginForm {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  hasError(name: 'email' | 'password', key: string): boolean {
    const control = this.form.get(name);
    return !!control && control.touched && control.hasError(key);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();
    this.authService.login({ email: email.trim().toLowerCase(), password }).subscribe({
      next: (payload) => {
        this.loading.set(false);
        // Quien aún no ha contado de qué trata su empresa empieza por ahí; el resto, por el inicio.
        this.router.navigateByUrl(payload.onboarding?.next_step === 'organizational_context' ? '/onboarding' : '/');
      },
      error: (error) => {
        this.loading.set(false);
        // El backend ya distingue credenciales malas, cuenta bloqueada o inactiva, y lo traduce.
        this.errorMessage.set(apiErrorMessage(error, this.translate.instant('AUTH.LOGIN.ERROR_FALLBACK')));
      },
    });
  }
}
