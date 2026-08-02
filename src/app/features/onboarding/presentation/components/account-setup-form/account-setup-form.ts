import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OnboardingService } from '@features/onboarding/domain/services/onboarding.service';
import { AuthService } from '@features/auth/domain/services/auth.service';
import { RegistrationSessionService } from '@core/domain/services/registration-session.service';

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
  private readonly authService = inject(AuthService);
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

    const apiKey = this.registrationSession.apiKey();
    if (!apiKey) {
      this.router.navigateByUrl('/register');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();
    const username = email.split('@')[0];

    this.onboardingService.createAdmin({ api_key: apiKey, email, username, password }).subscribe({
      next: () => {
        this.authService.login({ identifier: username, password, api_key: apiKey }).subscribe({
          next: () => {
            this.loading.set(false);
            this.registrationSession.clear();
            this.router.navigateByUrl('/onboarding/company-profile');
          },
          error: () => {
            this.loading.set(false);
            this.router.navigateByUrl('/signin');
          },
        });
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('No se pudo crear la cuenta. Verifica los datos ingresados.');
      },
    });
  }
}
