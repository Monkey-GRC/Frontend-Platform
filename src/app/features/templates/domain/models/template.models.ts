export interface MasterTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  objective?: string;
  scope?: string;
}

export interface Template {
  id: string;
  name: string;
  slug: string;
  description?: string;
  objective?: string;
  scope?: string;
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

export interface Control {
  id: string;
  name: string;
  description?: string;
  objective?: string;
  type?: ControlType;
  os?: OperatingSystem;
  checklist?: ChecklistItem[];
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
  description?: string;
  impact: number;
  probability: number;
  templateId?: string;
}

export interface CreateReasonDto {
  name: string;
  description?: string;
}

export interface Reason {
  id: string;
  name: string;
  description?: string;
}

export interface LinkRisksDto {
  riskIds: string[];
}

export interface LinkControlsDto {
  controlIds: string[];
}
