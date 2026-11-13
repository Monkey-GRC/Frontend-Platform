import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { AuthService } from '@core/domain/services/auth.service';
import { postLoginPath } from '@core/domain/utils/post-login-path';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';
import { PasswordToggle } from '@shared/presentation/components/password-toggle/password-toggle';

@Component({
  selector: 'app-login-form',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, PasswordToggle, Busy, BusyFields],
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
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();
    this.authService.login({ email: email.trim().toLowerCase(), password }).subscribe({
      next: (outcome) => {
        // Con el segundo factor obligatorio no hay sesión todavía: falta el código (o configurarlo).
        // Ocupado hasta que termina la navegación (D116).
        if (outcome.kind === 'mfa') {
          this.navigate('/mfa');
          return;
        }
        const payload = outcome.payload;
        // `replaceUrl`: el inicio de sesión no queda en el historial, así «atrás» no vuelve a él.
        // Quien aún no ha contado de qué trata su empresa empieza por ahí; el resto, por el inicio.
        this.navigate(postLoginPath(payload.user.role, payload.onboarding));
      },
      error: (error) => {
        this.loading.set(false);
        // El backend ya distingue credenciales malas, cuenta bloqueada o inactiva, y lo traduce.
        this.errorMessage.set(apiErrorMessage(error, this.translate.instant('AUTH.LOGIN.ERROR_FALLBACK')));
      },
    });
  }

  private navigate(url: string): void {
    this.router.navigateByUrl(url, { replaceUrl: true }).then(
      () => this.loading.set(false),
      () => this.loading.set(false),
    );
  }
}
