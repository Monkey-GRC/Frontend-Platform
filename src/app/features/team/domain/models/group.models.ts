// contracts/gestion-usuarios.md → «Grupos» (D102, D104). Un grupo tiene un nombre y un líder; cada persona (salvo `admin_empresa` y `auditor`) pertenece a uno.

/** `responsables`: lo lidera el administrador y ahí queda todo `responsable`. `team`: el equipo de delegados de un `responsable`. */
export type GroupKind = 'responsables' | 'team';

export interface GroupLeader {
  id: string;
  name: string | null;
  last_name: string | null;
  role: string;
}

export interface Group {
  id: string;
  name: string;
  kind: GroupKind;
  leader: GroupLeader;
  /** Cuentas del grupo de cualquier estado; el líder de un equipo no cuenta. */
  members_count: number;
}

export interface CreateGroupDto {
  name: string;
  /** Solo el administrador: el responsable cuyo equipo de delegados se crea. Sin él, crea un grupo de responsables que lidera él. El responsable que crea su equipo no lo manda. */
  leader_id?: string;
}
