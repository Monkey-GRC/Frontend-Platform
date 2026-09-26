import { Injectable, signal } from '@angular/core';

/**
 * Guarda la clave de acceso mientras el cliente completa su registro,
 * antes de que exista sesión. Ver decisión D24 del modelo.
 */
@Injectable({ providedIn: 'root' })
export class RegistrationSessionService {
  private readonly onboardingCodeSignal = signal<string | null>(null);

  readonly onboardingCode = this.onboardingCodeSignal.asReadonly();

  setOnboardingCode(onboardingCode: string): void {
    this.onboardingCodeSignal.set(onboardingCode);
  }

  clear(): void {
    this.onboardingCodeSignal.set(null);
  }
}
