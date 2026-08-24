export interface DashboardSummary {
  frameworkCompliance: number | null;
  controlsCompliant: number;
  controlsEvaluated: number;
  controlsTotal: number;
  openFindings: number;
  serversEvaluated: number;
}

export type DashboardControlType = 'MANUAL' | 'AUTOMATIC' | 'HYBRID';

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
  compliance: number | null;
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  checksNotApplicable: number;
  checksPending: number;
}

export type CheckResult = 'passed' | 'failed' | 'not_applicable';

export interface ControlCheckDetail {
  checkId: string;
  title: string;
  os: string;
  result: CheckResult;
  description: string | null;
  rationale: string | null;
  remediation: string | null;
}

export interface ControlChecksDetail {
  id: string;
  code: string;
  name: string;
  checks: ControlCheckDetail[];
}
