import { Injectable, signal } from '@angular/core';
import { BusinessType } from '@features/onboarding/domain/models/onboarding.models';

@Injectable({ providedIn: 'root' })
export class RegistrationSessionService {
  private readonly onboardingCodeSignal = signal<string | null>(null);
  private readonly businessTypeSignal = signal<BusinessType | null>(null);
  private readonly serverCountSignal = signal<number | null>(null);
  private readonly characterizationDoneSignal = signal(false);
  private readonly templateIdSignal = signal<string | null>(null);
  private readonly templateStepDoneSignal = signal(false);

  readonly onboardingCode = this.onboardingCodeSignal.asReadonly();
  readonly businessType = this.businessTypeSignal.asReadonly();
  readonly serverCount = this.serverCountSignal.asReadonly();
  readonly characterizationDone = this.characterizationDoneSignal.asReadonly();
  readonly templateId = this.templateIdSignal.asReadonly();
  readonly templateStepDone = this.templateStepDoneSignal.asReadonly();

  setOnboardingCode(onboardingCode: string): void {
    this.onboardingCodeSignal.set(onboardingCode);
  }

  setCharacterization(businessType: BusinessType, serverCount: number): void {
    this.businessTypeSignal.set(businessType);
    this.serverCountSignal.set(serverCount);
    this.characterizationDoneSignal.set(true);
  }

  selectTemplate(templateId: string): void {
    this.templateIdSignal.set(templateId);
    this.templateStepDoneSignal.set(true);
  }

  skipTemplate(): void {
    this.templateIdSignal.set(null);
    this.templateStepDoneSignal.set(true);
  }

  clear(): void {
    this.onboardingCodeSignal.set(null);
    this.businessTypeSignal.set(null);
    this.serverCountSignal.set(null);
    this.characterizationDoneSignal.set(false);
    this.templateIdSignal.set(null);
    this.templateStepDoneSignal.set(false);
  }
}
