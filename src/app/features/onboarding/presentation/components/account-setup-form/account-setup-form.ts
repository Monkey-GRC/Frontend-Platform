import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OnboardingService } from '@features/onboarding/domain/services/onboarding.service';
import { RegistrationSessionService } from '@core/domain/services/registration-session.service';
import { SessionService } from '@core/domain/services/session.service';
import { TenantCredentialsService } from '@core/domain/services/tenant-credentials.service';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-account-setup-form',
  imports: [ReactiveFormsModule],
  templateUrl: './account-setup-form.html',
  styleUrl: './account-setup-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSetupForm {
  private readonly fb = inject(FormBuilder);
  private readonly onboardingService = inject(OnboardingService);
  private readonly sessionService = inject(SessionService);
  private readonly tenantCredentials = inject(TenantCredentialsService);
  private readonly registrationSession = inject(RegistrationSessionService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordsMatchValidator });

  hasError(name: 'email' | 'password' | 'confirmPassword', key: string): boolean {
    const control = this.form.get(name);
    return !!control && control.touched && control.hasError(key);
  }

  get passwordsMismatch(): boolean {
    const confirmPassword = this.form.get('confirmPassword');
    return this.form.hasError('passwordMismatch') && !!confirmPassword?.touched;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const onboardingCode = this.registrationSession.onboardingCode()!;
    const templateId = this.registrationSession.templateId() ?? undefined;
    const businessType = this.registrationSession.businessType() ?? undefined;
    const serverCount = this.registrationSession.serverCount() ?? undefined;

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();
    const username = email.split('@')[0];

    this.onboardingService
      .complete({
        onboarding_code: onboardingCode,
        template_id: templateId,
        email,
        username,
        password,
        business_type: businessType,
        server_count: serverCount,
      })
      .subscribe({
        next: (result) => {
          // client_identifier/client_key nunca se muestran al usuario — se
          // guardan en silencio y de ahí en adelante viajan solos como
          // headers en cada request (ver tenantCredentialsInterceptor).
          this.tenantCredentials.save(result.client_identifier, result.client_key);
          this.sessionService.setAuthenticated();
          this.registrationSession.clear();
          this.router.navigateByUrl('/');
        },
        error: (error) => {
          this.loading.set(false);
          if (error.status === 401) {
            this.errorMessage.set('Código de onboarding inválido.');
          } else if (error.status === 409) {
            this.errorMessage.set('Este tenant ya fue activado, inicia sesión normalmente.');
          } else if (error.status === 410) {
            this.errorMessage.set('El código expiró, pide a soporte que te genere uno nuevo.');
          } else {
            this.errorMessage.set('Ocurrió un error, intenta de nuevo.');
          }
        },
      });
  }
}
