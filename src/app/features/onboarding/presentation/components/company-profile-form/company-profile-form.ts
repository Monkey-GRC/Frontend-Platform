import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OnboardingService } from '@features/onboarding/domain/services/onboarding.service';
import { BusinessType } from '@features/onboarding/domain/models/onboarding.models';

@Component({
  selector: 'app-company-profile-form',
  imports: [ReactiveFormsModule],
  templateUrl: './company-profile-form.html',
  styleUrl: './company-profile-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyProfileForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly onboardingService = inject(OnboardingService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly businessTypes: BusinessType[] = ['E_COMMERCE', 'FINTECH', 'SAAS', 'HEALTHTECH', 'OTHER'];

  readonly form = this.fb.nonNullable.group({
    business_type: [null as BusinessType | null, Validators.required],
    server_count: [null as number | null, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.onboardingService.getCompanyProfile().subscribe((profile) => {
      this.form.patchValue({
        business_type: profile.business_type ?? null,
        server_count: profile.server_count ?? null,
      });
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { business_type, server_count } = this.form.getRawValue();

    this.onboardingService.updateCompanyProfile({
      business_type: business_type ?? undefined,
      server_count: server_count ?? undefined,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl('/');
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('No se pudo guardar el perfil de la empresa.');
      },
    });
  }
}
