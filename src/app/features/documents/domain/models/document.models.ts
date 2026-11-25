// contracts/documentos.md (corte mínimo de Documentos, MD-503; D133, D136, D152). Los nombres de los campos son los del contrato.

/** `document_type` (contracts/enums/catalogo-maestro.md); sus etiquetas las sirve `GET /v1/catalogs/document_type`. */
export type DocumentType = 'policy' | 'procedure' | 'matrix' | 'manual' | 'document';
export type DocumentOrigin = 'internal' | 'external';
/** `document_acceptance`: quién debe aceptarlo. */
export type DocumentAcceptance = 'users_who_apply' | 'all_users' | 'not_required';
export type DocumentVersionStatus = 'draft' | 'in_approval' | 'rejected' | 'approved' | 'current' | 'renewal_due' | 'expired' | 'archived';
/** `my_document_status` (contracts/enums/documentos.md): se deriva, no se guarda. */
export type MyDocumentStatus = 'pending' | 'accepted' | 'overdue';

export interface DocumentCurrentVersion {
  id: string;
  number: number;
  /** Día `AAAA-MM-DD` en que se aprobó (fuera de Monkey, si es una aprobación importada). */
  approved_at: string;
  is_imported_approval: boolean;
  file_name: string;
  file_type: string;
}

/** Cuántas personas lo tienen asignado y en qué punto está cada una. Los porcentajes no viajan: la pantalla muestra los conteos. */
export interface DocumentAssignmentCounts {
  total: number;
  accepted: number;
  pending: number;
  overdue: number;
}

export interface DocumentListItem {
  id: string;
  /** `POL-001`: siempre visible. */
  code: string;
  name: string;
  type: DocumentType;
  origin: DocumentOrigin;
  acceptance: DocumentAcceptance;
  current_version: DocumentCurrentVersion | null;
  assignments: DocumentAssignmentCounts;
}

export interface DocumentApprover {
  name: string;
  role_label: string;
}

export interface ImportedApproval {
  approvers: DocumentApprover[];
  approved_at: string;
  note: string | null;
}

export interface DocumentVersion {
  id: string;
  number: number;
  status: DocumentVersionStatus;
  approved_at: string;
  is_imported_approval: boolean;
  imported_approval: ImportedApproval | null;
  file_name: string;
  file_type: string;
  file_size: number;
  /** Huella SHA-256 del archivo. */
  integrity_hash: string;
  created_at: string;
}

export interface DocumentAssignee {
  user: { id: string; name: string | null; last_name: string | null; role: string };
  assigned_at: string;
  due_at: string;
  status: MyDocumentStatus;
  /** La última versión que aceptó; con una versión nueva sin aceptar sigue siendo la anterior. */
  accepted_version_number: number | null;
  accepted_at: string | null;
}

export interface DocumentDetail extends DocumentListItem {
  description: string | null;
  minimum_content: string | null;
  versions: DocumentVersion[];
  assignees: DocumentAssignee[];
}

export interface DocumentFilters {
  page: number;
  pageSize: number;
  q?: string;
  /** Un valor de `document_type` (lo sirve el catálogo). */
  type?: string | null;
  /** `true`: solo los publicados; `false`: solo los que aún no tienen versión vigente; `null`: todos. */
  hasCurrentVersion?: boolean | null;
}

/** Un ítem de `GET /v1/me/documents`. */
export interface MyDocument {
  document: { id: string; code: string; name: string; type: DocumentType };
  /** La versión vigente (la que hay que leer y aceptar). */
  version: { id: string; number: number; approved_at: string };
  requires_acceptance: boolean;
  status: MyDocumentStatus;
  assigned_at: string;
  due_at: string;
  accepted_at: string | null;
}

/** La publicación de una versión importada (`multipart/form-data`). */
export interface PublishVersionDto {
  file: File;
  /** Día `AAAA-MM-DD`; no puede ser futuro. */
  approved_at: string;
  /** De 1 a 3: quién lo aprobó fuera de Monkey, en texto (pueden no tener cuenta, D152). */
  approvers: DocumentApprover[];
  note?: string;
}

export type FileDisposition = 'inline' | 'attachment';

/** El enlace firmado (5 minutos) para ver o bajar el archivo de una versión. */
export interface DocumentFileLink {
  url: string;
  file_name: string;
  file_type: string;
  disposition: FileDisposition;
  expires_in: number;
}

export interface DocumentAcceptanceReceipt {
  id: string;
  document_id: string;
  version: { id: string; number: number };
  accepted_at: string;
  integrity_hash: string;
}

export const MAX_APPROVERS = 3;
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_FILE_TYPES: readonly string[] = ['.pdf', '.docx', '.png', '.jpg', '.jpeg'];
/** Tope de personas por asignación (contrato: 1 a 200). */
export const MAX_ASSIGNEES = 200;
