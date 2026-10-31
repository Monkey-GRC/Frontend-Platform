import { Injectable, computed, signal } from '@angular/core';

// Quién está en sesión, para cualquier feature que lo necesite (vive en core para que ninguna
// feature importe a auth). Los tokens nunca pasan por aquí: viajan en cookies httpOnly.
export interface SessionUser {
  id: string;
  email: string;
  // Opcionales: la cuenta se identifica por el correo (D51).
  name: string | null;
  last_name: string | null;
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

// Marca (no secreta) de que este navegador abrió una sesión. Las cookies de sesión son httpOnly y el código no las puede ver: sin esta marca, cada
// visita a la pantalla de acceso consultaba /auth/me y llenaba la consola de 401. La marca NO autentica nada: el servidor sigue validando la sesión
// de verdad. Si falta o no se puede leer (modo privado), la app se comporta como antes y pregunta al servidor.
const SESSION_HINT_KEY = 'mk_session';
const readHint = (): boolean => {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return true;
  }
};
const writeHint = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(SESSION_HINT_KEY, '1');
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // sin almacenamiento: se pregunta siempre al servidor
  }
};

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly userSignal = signal<SessionUser | null>(null);
  private readonly companySignal = signal<SessionCompany | null>(null);
  private readonly onboardingSignal = signal<SessionOnboarding | null>(null);

  readonly user = this.userSignal.asReadonly();
  readonly company = this.companySignal.asReadonly();
  readonly onboarding = this.onboardingSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  /** ¿Este navegador abrió una sesión alguna vez (y no la cerró)? Solo evita preguntar al servidor sin necesidad. */
  hasSessionHint(): boolean {
    return readHint();
  }

  set(user: SessionUser, company: SessionCompany, onboarding: SessionOnboarding | null = null): void {
    writeHint(true);
    this.userSignal.set(user);
    this.companySignal.set(company);
    this.onboardingSignal.set(onboarding);
  }

  clear(): void {
    writeHint(false);
    this.userSignal.set(null);
    this.companySignal.set(null);
    this.onboardingSignal.set(null);
  }
}
