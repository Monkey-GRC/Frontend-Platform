export interface ContractedTemplateSummary {
  id: string;
  name: string;
  compliance: number | null;
}

export interface DashboardSummary {
  frameworkCompliance: number | null;
  controlsCompliant: number;
  controlsEvaluated: number;
  controlsTotal: number;
  openFindings: number;
  serversEvaluated: number;
  companyName: string;
  assetsCount: number;
  contractedTemplates: ContractedTemplateSummary[];
}

export type DashboardControlType = 'MANUAL' | 'AUTOMATIC' | 'HYBRID';

export type ControlDimension = 'POLICY' | 'SERVER' | 'DATABASE' | 'CLOUD' | 'APP';

export interface DimensionCompliance {
  dimension: ControlDimension;
  type: DashboardControlType;
  /** 0 si la dimensión aplica pero no tiene ninguna evidencia resuelta todavía. */
  compliance: number;
  checksPassed: number;
  checksFailed: number;
  checksNotApplicable: number;
  checksPending: number;
}

export interface DashboardServerCompliance {
  assetId: string;
  assetCode: string;
  assetName: string;
  os: string;
  osName: string | null;
  osVersion: string | null;
  status: string;
  compliance: number | null;
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  checksNotApplicable: number;
}

export interface DashboardControl {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: DashboardControlType;
  /** Promedio de las dimensiones aplicables — ver `dimensions`, no un promedio de checks crudos. */
  compliance: number | null;
  /** Desglose por cada dimensión aplicable (Política/Servidor/BD/Nube/App). Las no aplicables no aparecen. */
  dimensions: DimensionCompliance[];
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  checksNotApplicable: number;
  checksPending: number;
}

export type CheckResult = 'passed' | 'failed' | 'not_applicable';

export interface FailingAsset {
  assetId: string;
  name: string;
}

export interface ControlCheckDetail {
  checkId: string;
  title: string;
  os: string;
  dimension: ControlDimension;
  result: CheckResult;
  description: string | null;
  rationale: string | null;
  remediation: string | null;
  /** Servidores específicos que incumplen este check. Vacío si result no es "failed". */
  failingAssets: FailingAsset[];
}

export interface ControlChecksDetail {
  id: string;
  code: string;
  name: string;
  checks: ControlCheckDetail[];
}
