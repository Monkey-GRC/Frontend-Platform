// contracts/modules/users-team.md (D96): el equipo de la empresa y el reparto del trabajo por dimensión.

export type Dimension = 'policy' | 'server' | 'database' | 'app' | 'cloud';
export type TeamRole = 'admin_empresa' | 'funcional' | 'auditor';
export type TeamStatus = 'active' | 'inactive' | 'pending';

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  last_name: string | null;
  role: TeamRole;
  status: TeamStatus;
  is_mfa_enabled: boolean;
  last_login_at: string | null;
  /** Solo un `funcional` tiene especialidades. */
  dimensions: Dimension[];
  created_at: string;
}

/** El código de un solo uso que el administrador le entrega a la persona. Viaja en claro solo al emitirlo. */
export interface ActivationCode {
  code: string;
  status: 'pending';
  expires_at: string;
}

export interface TeamMemberWithCode extends TeamMember {
  activation_code: ActivationCode;
}

export interface TeamPage {
  items: TeamMember[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface InviteDto {
  email: string;
  role: 'funcional' | 'auditor';
  dimensions?: Dimension[];
}

export interface UpdateMemberDto {
  status?: 'active' | 'inactive';
  dimensions?: Dimension[];
}

export interface ResponsiblePerson {
  id: string;
  email: string;
  name: string | null;
  last_name: string | null;
}

export interface DimensionOwner {
  dimension: Dimension;
  owner: ResponsiblePerson | null;
  controls_total: number;
  controls_with_exception: number;
  controls_without_owner: number;
}

export interface ServiceRef {
  id: string;
  name: string;
}
