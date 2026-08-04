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
