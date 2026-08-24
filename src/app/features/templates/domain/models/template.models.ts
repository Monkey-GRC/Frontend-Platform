export interface MasterTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  objective?: string;
  scope?: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TemplateRiskSummary {
  id: string;
  name: string;
  code: string;
  level: RiskLevel;
}

export interface Template {
  id: string;
  name: string;
  slug: string;
  description?: string;
  objective?: string;
  scope?: string;
  risks?: TemplateRiskSummary[];
}

export interface CreateTemplateDto {
  name: string;
  slug: string;
  description?: string;
  objective?: string;
  scope?: string;
}

export type UpdateTemplateDto = Partial<CreateTemplateDto>;

export type OperatingSystem = 'UBUNTU' | 'WINDOWS';

export interface ChecklistItem {
  checkId: string;
  title: string;
}

export type ControlType = 'MANUAL' | 'AUTOMATIC' | 'HYBRID';

export interface CreateControlDto {
  name: string;
  description?: string;
  objective?: string;
  type?: ControlType;
  os?: OperatingSystem;
  checklist?: ChecklistItem[];
}

export interface ControlCheckLink {
  id: string;
  check_id: string;
  title: string;
  os: OperatingSystem;
}

export interface Control {
  id: string;
  name: string;
  code: string;
  description?: string;
  objective?: string;
  type: ControlType;
  checks: ControlCheckLink[];
}

export type ManualCheckStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'NOT_APPLICABLE';

export interface ManualCheckUserSummary {
  id: string;
  name: string | null;
  last_name: string | null;
  username: string;
}

export interface ManualCheckEvidence {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedAt: string;
  uploadedBy: ManualCheckUserSummary | null;
}

export interface ManualCheckEvidenceWithUrl extends ManualCheckEvidence {
  downloadUrl: string;
}

export interface ManualCheckItem {
  id: string;
  controlId: string;
  title: string;
  description: string | null;
  remediation: string | null;
  status: ManualCheckStatus;
  notes: string | null;
  evaluatedAt: string | null;
  evaluatedBy: ManualCheckUserSummary | null;
  createdAt: string;
  updatedAt: string;
  evidence: ManualCheckEvidence[];
}

export interface CreateManualCheckDto {
  title: string;
  description?: string;
  remediation?: string;
}

export interface UpdateManualCheckDto {
  title?: string;
  description?: string;
  remediation?: string;
}

export interface SetManualCheckStatusDto {
  status: ManualCheckStatus;
  notes?: string;
}

export interface UpdateRiskDto {
  templateId?: string | null;
}

export interface CreateRiskDto {
  name: string;
  description?: string;
  impact: number;
  probability: number;
  templateId?: string;
}

export interface Risk {
  id: string;
  name: string;
  code: string;
  description?: string;
  impact: number;
  probability: number;
  level: RiskLevel;
}

export interface ReasonSummary {
  id: string;
  name: string;
  code: string;
}

export interface RiskDetail extends Risk {
  reasons: ReasonSummary[];
}

export interface CreateReasonDto {
  name: string;
  description?: string;
}

export interface Reason {
  id: string;
  name: string;
  code: string;
  description?: string;
}

export interface ReasonDetail extends Reason {
  risks: { id: string; name: string; code: string; level: RiskLevel }[];
  controls: Control[];
}

export interface LinkRisksDto {
  riskIds: string[];
}

export interface LinkControlsDto {
  controlIds: string[];
}

export interface TemplateTreeCheck {
  check_id: string;
  title: string;
  os: OperatingSystem;
  soc2_code: string | null;
  cis_code: string | null;
  pci_dss_code: string | null;
  soc2_code_inferred: string | null;
  soc2_mapping_source: string | null;
  soc2_mapping_confidence: string | null;
  soc2_mapping_citation: string | null;
}

export interface TemplateTreeManualCheck {
  id: string;
  title: string;
  description: string | null;
  remediation: string | null;
  status: ManualCheckStatus;
}

export interface TemplateTreeControl {
  id: string;
  name: string;
  code: string;
  description: string | null;
  objective: string | null;
  type: ControlType;
  checks: TemplateTreeCheck[];
  manual_checks: TemplateTreeManualCheck[];
}

export interface TemplateTreeReason {
  id: string;
  name: string;
  code: string;
  description: string | null;
  controls: TemplateTreeControl[];
}

export interface TemplateTreeRisk {
  id: string;
  name: string;
  code: string;
  description: string | null;
  impact: number;
  probability: number;
  level: RiskLevel;
  reasons: TemplateTreeReason[];
}

export interface TemplateFullTree {
  id: string;
  name: string;
  code: string;
  description: string | null;
  objective: string | null;
  scope: string | null;
  risks: TemplateTreeRisk[];
}
