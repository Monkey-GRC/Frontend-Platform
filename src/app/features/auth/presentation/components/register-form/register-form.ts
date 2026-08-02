import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RegistrationSessionService } from '@core/domain/services/registration-session.service';

@Component({
  selector: 'app-register-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-form.html',
  styleUrl: './register-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterForm {
  private readonly fb = inject(FormBuilder);
  private readonly registrationSession = inject(RegistrationSessionService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    api_key: ['', Validators.required],
  });

  hasError(name: 'api_key', key: string): boolean {
    const control = this.form.get(name);
    return !!control && control.touched && control.hasError(key);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.registrationSession.setApiKey(this.form.getRawValue().api_key);
    this.router.navigateByUrl('/onboarding/account');
  }
}
