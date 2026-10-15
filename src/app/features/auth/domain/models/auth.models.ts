// contracts/modules/auth.md
export interface LoginDto {
  email: string;
  password: string;
}

// Activación en dos pasos (D51). Paso 1: con solo el código se muestra la empresa y el correo que fijó Monkey.
export interface AccessKeyLookup {
  company: { name: string };
  admin_email: string;
  expires_at: string;
}

// Paso 2 — primer acceso: canjea la clave de acceso (una sola vez). El administrador se identifica por su
// correo: solo se pide la contraseña.
export interface RedeemDto {
  code: string;
  email: string;
  password: string;
}

export type UserRole = 'admin_monkey' | 'admin_empresa' | 'funcional' | 'consultor' | 'auditor';

export interface AuthUser {
  id: string;
  email: string;
  // Opcionales: la cuenta se identifica por el correo (D51).
  name: string | null;
  last_name: string | null;
  role: UserRole;
  status: 'active' | 'inactive' | 'suspended';
  is_mfa_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AuthCompany {
  id: string;
  name: string;
}

export interface OnboardingProgress {
  next_step: string | null;
  completed_steps: string[];
}

export interface AuthPayload {
  user: AuthUser;
  company: AuthCompany;
  onboarding?: OnboardingProgress;
}
