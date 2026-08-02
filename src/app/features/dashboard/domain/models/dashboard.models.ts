export interface DashboardSummary {
  frameworkCompliance: number | null;
  controlsCompliant: number;
  controlsTotal: number;
  openFindings: number;
}

export interface DashboardControl {
  id: string;
  code: string;
  name: string;
  description: string | null;
  compliance: number | null;
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  checksNotApplicable: number;
}

export type CheckResult = 'passed' | 'failed' | 'not_applicable';

export interface ControlCheckDetail {
  checkId: string;
  title: string;
  os: string;
  result: CheckResult;
}

export interface ControlChecksDetail {
  id: string;
  code: string;
  name: string;
  checks: ControlCheckDetail[];
}
