export interface DashboardSummary {
  frameworkCompliance: number | null;
  controlsCompliant: number;
  controlsEvaluated: number;
  controlsTotal: number;
  openFindings: number;
}

export type DashboardControlType = 'MANUAL' | 'AUTOMATIC' | 'HYBRID';

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
