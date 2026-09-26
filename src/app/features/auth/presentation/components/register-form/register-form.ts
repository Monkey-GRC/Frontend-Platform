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
    onboarding_code: ['', Validators.required],
  });

  hasError(name: 'onboarding_code', key: string): boolean {
    const control = this.form.get(name);
    return !!control && control.touched && control.hasError(key);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.registrationSession.setOnboardingCode(this.form.getRawValue().onboarding_code.trim());

    // TODO (MD-71): validar la clave contra el backend, crear la cuenta
    // admin_empresa y dejar la sesion abierta; de ahi se entra al Componente 1
    // del onboarding (MD-74). El destino queda sin definir hasta que exista.

  }
}
