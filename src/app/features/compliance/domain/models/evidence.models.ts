// Evidencias (contracts/modules/compliance-evidence.md). Se llaman así (D80):
//   · evidencia REQUERIDA (`evidence_requirements`): lo que el control exige que se aporte, y quién responde por aportarlo;
//   · evidencia ENTREGADA (`evidence_submissions`): lo que se sube para cumplir ese requerimiento, con su versión y su huella.
// «Prueba» no se usa aquí: en el cerebro una prueba es el test que ejecuta el motor.

// Lo deriva el servidor de la revisión del `admin_empresa`; nadie lo escribe. Quien sube (el delegado, o el responsable) no revisa lo suyo (D102).
export type EvidenceState = 'compliant' | 'non_compliant' | 'pending' | 'in_review' | 'expired' | 'not_applicable';

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
  submitted_by: EvidencePerson;
  submitted_at: string;
  evidence_state: EvidenceState;
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
  // D88 · La prueba documental de ESTE control a la que sirve la evidencia. `null` = compartida con todas las pruebas documentales del control
  // (así llegan las plantillas del catálogo, que no dicen a cuál sirve cada documento).
  test: { id: string; code: string; display_name: string | null } | null;
  validity_within_period: string;
  origin: 'catalog' | 'own';
  responsible: { id: string; type: string; person_name: string | null } | null;
  submissions: EvidenceSubmission[];
  // Solo en la evidencia de una prueba: de qué control es el requerimiento (una prueba puede estar en varios controles del servicio, D85).
  control?: { id: string; code: string };
}

/**
 * Lo que se entregó PARA una prueba documental EN SU CONTROL (D88). Un documento que el catálogo sugiere sin decir a qué prueba sirve (`test` nulo) no cuenta para
 * ninguna prueba: el servidor tampoco lo tiene en cuenta. El estado de la prueba lo calcula el servidor; aquí solo se decide qué se muestra bajo cada una.
 */
export function evidenceForTest(requirements: readonly EvidenceRequirement[], dimension: string, testId: string): EvidenceRequirement[] {
  return requirements.filter((r) => r.dimension === dimension && r.test?.id === testId);
}

/** Los documentos que el catálogo sugiere para el control sin decir a qué prueba sirven: una guía para quien sube, no un requisito de ninguna prueba. */
export function suggestedEvidence(requirements: readonly EvidenceRequirement[], dimension: string): EvidenceRequirement[] {
  return requirements.filter((r) => r.dimension === dimension && r.test === null && r.origin === 'catalog');
}

// ── La pestaña «Evidencias» (MD-129): una fila por evidencia requerida, con el control que la pide ──

/** Qué se busca en la bandeja. «Sin entregar» = nadie ha subido nada; «por revisar» = ya se entregó y falta (o está en) revisión del administrador de la empresa. */
export type EvidenceFilter = 'all' | 'missing' | 'to_review' | 'reviewed';
export const EVIDENCE_FILTERS: readonly EvidenceFilter[] = ['all', 'missing', 'to_review', 'reviewed'];

export interface EvidenceInboxRow {
  control: { id: string; name: string; code: string | null };
  requirement: EvidenceRequirement;
  /** La entrega más reciente (la API las manda de la más nueva a la más antigua); null si aún no se ha entregado nada. */
  latest: EvidenceSubmission | null;
}

/** En qué grupo cae una fila. El estado lo calcula el servidor (D84); aquí solo se agrupa, nunca se decide. */
export function evidenceFilterOf(row: EvidenceInboxRow): Exclude<EvidenceFilter, 'all'> {
  if (!row.latest) return 'missing';
  return row.latest.evidence_state === 'pending' || row.latest.evidence_state === 'in_review' ? 'to_review' : 'reviewed';
}

/** Une los controles con sus evidencias, en el orden de los controles; los que no piden evidencia no aparecen. */
export function buildInboxRows(
  controls: readonly { id: string; name: string; code?: string | null; own_code?: string | null }[],
  evidence: ReadonlyMap<string, EvidenceRequirement[]>,
): EvidenceInboxRow[] {
  return controls.flatMap((c) =>
    (evidence.get(c.id) ?? []).map((requirement) => ({
      control: { id: c.id, name: c.name, code: c.code ?? c.own_code ?? null },
      requirement,
      latest: requirement.submissions[0] ?? null,
    })),
  );
}

/** `inline` = para ver en pantalla (solo PDF, PNG y JPG); `attachment` = para bajar el archivo. */
export type EvidenceDisposition = 'inline' | 'attachment';

export interface EvidenceDownload {
  url: string;
  file_name: string;
  file_type?: string;
  disposition?: EvidenceDisposition;
  expires_in: number;
}

/** Lo que se puede ver en pantalla sin bajarlo (contrato: `inline` solo admite estos tipos; DOCX y XLSX se descargan). */
export const EVIDENCE_PREVIEW_TYPES: readonly string[] = ['application/pdf', 'image/png', 'image/jpeg'];

export function canPreviewEvidence(fileType: string): boolean {
  return EVIDENCE_PREVIEW_TYPES.includes(fileType);
}

/** La evidencia de UNA prueba manual (GET /controls/{id}/tests/{test_id}/evidence): los requerimientos que la respaldan y los otros controles a los que también aplica (D85). */
export interface EvidenceTestList {
  test_id: string;
  shared_with: { id: string; code: string }[];
  items: EvidenceRequirement[];
}

// Tipos y tamaño que acepta la subida. El contrato lo PROPONE (PDF, DOCX, XLSX, PNG y JPG, hasta 25 MB, el tope de SEG-43) y deja abierta la
// confirmación con el comité. Esto es solo una validación previa para avisar rápido: el backend es quien manda (415 y 413).
export const EVIDENCE_FILE_ACCEPT: readonly string[] = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg'];
export const EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;
