import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RegistrationSessionService } from '@core/domain/services/registration-session.service';
import { BusinessType } from '@features/onboarding/domain/models/onboarding.models';

@Component({
  selector: 'app-characterization',
  imports: [ReactiveFormsModule],
  templateUrl: './characterization.html',
  styleUrl: './characterization.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Characterization {
  private readonly fb = inject(FormBuilder);
  private readonly registrationSession = inject(RegistrationSessionService);
  private readonly router = inject(Router);

  readonly businessTypes: BusinessType[] = ['E_COMMERCE', 'FINTECH', 'SAAS', 'HEALTHTECH', 'OTHER'];

  readonly form = this.fb.nonNullable.group({
    business_type: [null as BusinessType | null, Validators.required],
    server_count: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { business_type, server_count } = this.form.getRawValue();
    this.registrationSession.setCharacterization(business_type!, server_count!);
    this.router.navigateByUrl('/onboarding/templates');
  }
}
