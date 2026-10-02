// contracts/modules/auth.md
export interface LoginDto {
  email: string;
  password: string;
}

// Primer acceso: canje de la clave de acceso que entregó Monkey (una sola vez).
export interface RedeemDto {
  code: string;
  email: string;
  password: string;
  name: string;
  last_name: string;
}

export type UserRole = 'admin_monkey' | 'admin_empresa' | 'funcional' | 'auditor';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  last_name: string;
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
