import { PageInfo } from '@shared/domain/models/page-info.model';

// «Mi trabajo» (gestion-usuarios.md, MD-529): hoy solo la bandeja «Por aprobar» (`bucket=to_review`), del responsable y del administrador de la empresa.
export type WorkDecisionKind = 'control_approval' | 'manual_result' | 'level_override' | 'remediation_plan' | 'not_applicable';

export interface WorkItem {
  client_control_id: string;
  code: string;
  title: string;
  service: { id: string; name: string };
  role_in_control: string;
  bucket: string;
  pending_items: number;
  pending_decisions: WorkDecisionKind[];
  state: string;
}

export interface WorkPageDto {
  items: WorkItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  // `null` para el administrador de la empresa: no hay un avance de «toda la empresa».
  progress: unknown;
}

export interface WorkPage {
  items: WorkItem[];
  page: PageInfo;
}
