export type AssetType = 'SERVER' | 'DATABASE' | 'CLOUD_RESOURCE' | 'NETWORK_DEVICE';
export type AssetSource = 'WAZUH_AGENT' | 'MANUAL';
export type AssetStatus = 'ACTIVE' | 'INACTIVE';
export type AssetOs = 'UBUNTU' | 'WINDOWS';

export interface Asset {
  id: string;
  name: string;
  code: string;
  type: AssetType;
  source: AssetSource;
  external_id: string | null;
  os: AssetOs | null;
  os_name?: string | null;
  os_version?: string | null;
  status: AssetStatus;
  last_seen_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAssetDto {
  name: string;
  type: AssetType;
  source?: AssetSource;
  externalId?: string;
  os?: AssetOs;
}

export interface AssetComplianceCheck {
  checkId: string;
  title: string;
  result: string | null;
  description: string | null;
  rationale: string | null;
  remediation: string | null;
  soc2Code: string | null;
  cisCode: string | null;
  pciDssCode: string | null;
}

export interface AssetComplianceSummary {
  total: number;
  passed: number;
  failed: number;
  notApplicable: number;
  notEvaluated: number;
}

export interface AssetCompliance {
  asset: {
    id: string;
    code: string;
    name: string;
    os: AssetOs;
    osName: string | null;
    osVersion: string | null;
  };
  summary: AssetComplianceSummary;
  checks: AssetComplianceCheck[];
}
