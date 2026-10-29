// Exclusiones (contracts/modules/compliance-audit.md, MD-144, D96): sacar un ACTIVO del universo de una prueba. La crea y la decide el administrador de la empresa en un solo acto:
// nace aprobada. Los estados pending y rejected quedan sin uso. El veredicto de la sonda nunca se sobrescribe.

export type ExclusionStatus = 'pending' | 'approved' | 'rejected';

export interface ExclusionPerson {
  id: string;
  name: string | null;
  last_name: string | null;
}

export interface Exclusion {
  id: string;
  service_id: string;
  // De la prueba solo se ve su nombre neutro (D70).
  test: { id: string; display_name: string };
  asset: { id: string; name: string };
  justification: string;
  technical_justification: string | null;
  status: ExclusionStatus;
  // Una aprobada cuya vigencia ya pasó deja de excluir: el activo vuelve a contar.
  is_expired: boolean;
  valid_from: string;
  valid_until: string;
  proposed_by: ExclusionPerson;
  requested_at: string;
  decided_by: ExclusionPerson | null;
  decision_note: string | null;
  decided_at: string | null;
}
