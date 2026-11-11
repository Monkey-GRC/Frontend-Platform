// Lo mínimo del equipo que el Inicio necesita para contar. Es propio de `home`: la forma de `features/team` no cruza hacia aquí; `HomeTeamService` traduce.
import type { UserRole } from '@core/domain/models/auth.models';

export type HomeTeamRole = Exclude<UserRole, 'admin_monkey'>;
export type HomeTeamStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export interface HomeTeamMember {
  role: HomeTeamRole;
  status: HomeTeamStatus;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
}

/** Las personas leídas y si la lista quedó cortada por el tope de páginas (el resumen es parcial). */
export interface HomeTeamLoad {
  members: HomeTeamMember[];
  partial: boolean;
}
