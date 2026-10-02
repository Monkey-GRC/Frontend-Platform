import { Injectable, computed, signal } from '@angular/core';

// Quién está en sesión, para cualquier feature que lo necesite (vive en core para que ninguna
// feature importe a auth). Los tokens nunca pasan por aquí: viajan en cookies httpOnly.
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  last_name: string;
  role: string;
}

export interface SessionCompany {
  id: string;
  name: string;
}

// Dónde va el cliente en el onboarding (lo calcula el backend; el frontend no lo adivina).
export interface SessionOnboarding {
  next_step: string | null;
  completed_steps: string[];
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly userSignal = signal<SessionUser | null>(null);
  private readonly companySignal = signal<SessionCompany | null>(null);
  private readonly onboardingSignal = signal<SessionOnboarding | null>(null);

  readonly user = this.userSignal.asReadonly();
  readonly company = this.companySignal.asReadonly();
  readonly onboarding = this.onboardingSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  set(user: SessionUser, company: SessionCompany, onboarding: SessionOnboarding | null = null): void {
    this.userSignal.set(user);
    this.companySignal.set(company);
    this.onboardingSignal.set(onboarding);
  }

  clear(): void {
    this.userSignal.set(null);
    this.companySignal.set(null);
    this.onboardingSignal.set(null);
  }
}
