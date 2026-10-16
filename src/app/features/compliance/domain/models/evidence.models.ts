// Evidencias (contracts/modules/compliance-evidence.md). Se llaman así (D80):
//   · evidencia REQUERIDA (`evidence_requirements`): lo que el control exige que se aporte, y quién responde por aportarlo;
//   · evidencia ENTREGADA (`evidence_submissions`): lo que se sube para cumplir ese requerimiento, con su versión y su huella.
// «Prueba» no se usa aquí: en el cerebro una prueba es el test que ejecuta el motor.

export type EvidenceValidation = 'pending' | 'approved' | 'rejected';

export interface EvidencePerson {
  id: string;
  name: string | null;
  last_name: string | null;
}

// Una evidencia entregada. Una versión nueva nunca pisa la anterior.
export interface EvidenceSubmission {
  id: string;
  version: number;
  file_name: string;
  file_type: string;
  file_size: number;
  integrity_hash: string;
  validation_status: EvidenceValidation;
  submitted_by: EvidencePerson;
  submitted_at: string;
  approved_by: EvidencePerson | null;
  approved_at: string | null;
  decision_note: string | null;
  // Una sugerencia de la IA va siempre marcada; nunca aprueba nada.
  ai: { is_ai_generated: true; ai_confidence: number; verdict: string } | null;
}

// Una evidencia requerida, con sus entregas (la más reciente primero).
export interface EvidenceRequirement {
  id: string;
  code: string;
  sequence: number;
  description: string;
  dimension: string;
  validity_within_period: string;
  origin: 'catalog' | 'own';
  responsible: { id: string; type: string; person_name: string | null } | null;
  submissions: EvidenceSubmission[];
}

export interface EvidenceDownload {
  url: string;
  file_name: string;
  expires_in: number;
}

// Tipos y tamaño que acepta la subida. El contrato lo PROPONE (PDF, DOCX, XLSX, PNG y JPG, hasta 25 MB, el tope de SEG-43) y deja abierta la
// confirmación con el comité. Esto es solo una validación previa para avisar rápido: el backend es quien manda (415 y 413).
export const EVIDENCE_FILE_ACCEPT: readonly string[] = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg'];
export const EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;
