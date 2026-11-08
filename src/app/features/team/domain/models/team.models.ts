// contracts/gestion-usuarios.md (D96, D102, D104): el equipo de la empresa. El reparto por dimensión se retiró con D102 (MD-206).

export type TeamRole = 'admin_empresa' | 'responsable' | 'delegado' | 'auditor';
/** Quién usa la pantalla: el administrador gestiona todo; el responsable ve a su equipo y crea el suyo y delegados para él. */
export type TeamActor = 'admin_empresa' | 'responsable';
export type TeamStatus = 'active' | 'inactive' | 'pending' | 'suspended';

/** El grupo al que pertenece una persona (todos menos `admin_empresa` y `auditor`). */
export interface GroupRef {
  id: string;
  name: string;
}

/** El líder del grupo de un `delegado`: su responsable (no se guarda aparte). */
export interface ResponsibleRef {
  id: string;
  name: string | null;
  last_name: string | null;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  last_name: string | null;
  role: TeamRole;
  status: TeamStatus;
  is_mfa_enabled: boolean;
  /** Solo un `delegado`: si es de la compañía (`true`) o externo (`false`). Es una etiqueta, no cambia permisos. */
  is_internal?: boolean | null;
  group?: GroupRef | null;
  /** Solo un `delegado`. */
  responsible?: ResponsibleRef | null;
  last_login_at: string | null;
  created_at: string;
}

// La invitación sale por correo (D102 punto 14, MD-190): la respuesta nunca trae el código, solo si el correo salió. `sent` = el servicio de correo aceptó el mensaje;
// `failed` = la cuenta existe y se reenvía; `pending` está reservado y el servidor ya no lo produce.
export type InvitationDeliveryStatus = 'sent' | 'failed' | 'pending';

export interface Invitation {
  delivery_status: InvitationDeliveryStatus;
  expires_at: string;
}

/** La respuesta de crear a una persona: sus datos y el resultado del envío de su invitación. */
export interface InvitedMember extends TeamMember {
  invitation: Invitation;
}

export interface TeamPage {
  items: TeamMember[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

/** Los filtros de `GET /v1/users`; los vacíos no se mandan. */
export interface TeamFilters {
  role?: TeamRole | null;
  status?: TeamStatus | null;
  groupId?: string | null;
  isInternal?: boolean | null;
}

export interface InviteDto {
  email: string;
  name: string;
  last_name: string;
  role: TeamRole;
  /** `delegado`: su equipo (lo pone el administrador; si lo crea un responsable es el suyo y se omite). `responsable`: un grupo de responsables; por omisión, «Responsables». */
  group_id?: string;
  /** Solo `delegado`, obligatorio. */
  is_internal?: boolean;
}

export interface UpdateMemberDto {
  name?: string;
  last_name?: string;
  status?: 'active' | 'inactive';
  /** Mueve a un delegado al equipo de otro responsable (solo el administrador). */
  group_id?: string;
  /** `true` confirma que los controles que el delegado ejecuta quedan sin ejecutor (siguen con su dueño). Sin él, `USER_HAS_ASSIGNMENTS`. */
  confirm_unassign?: boolean;
}
