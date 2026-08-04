import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingService } from '@features/onboarding/domain/services/onboarding.service';
import { OnboardingMasterTemplate } from '@features/onboarding/domain/models/onboarding.models';
import { RegistrationSessionService } from '@core/domain/services/registration-session.service';
import { MasterTemplateList } from '@features/templates/presentation/components/master-template-list/master-template-list';

@Component({
  selector: 'app-template-selection',
  imports: [MasterTemplateList],
  templateUrl: './template-selection.html',
  styleUrl: './template-selection.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateSelection implements OnInit {
  private readonly onboardingService = inject(OnboardingService);
  private readonly registrationSession = inject(RegistrationSessionService);
  private readonly router = inject(Router);

  readonly masterTemplates = signal<OnboardingMasterTemplate[]>([]);
  readonly selectingId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const onboardingCode = this.registrationSession.onboardingCode()!;

    this.onboardingService.getMasterTemplates(onboardingCode).subscribe({
      next: (templates) => this.masterTemplates.set(templates),
      error: (error) => {
        if (error.status === 401) {
          this.errorMessage.set('Código de onboarding inválido.');
        } else if (error.status === 410) {
          this.errorMessage.set('El código expiró, pide a soporte que te genere uno nuevo.');
        } else {
          this.errorMessage.set('No se pudo cargar el catálogo de plantillas.');
        }
      },
    });
  }

  select(id: string): void {
    this.selectingId.set(id);
    this.registrationSession.selectTemplate(id);
    this.router.navigateByUrl('/onboarding/account');
  }

  skip(): void {
    this.registrationSession.skipTemplate();
    this.router.navigateByUrl('/onboarding/account');
  }
}
