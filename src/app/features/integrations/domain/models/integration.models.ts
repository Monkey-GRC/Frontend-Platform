// Forma exacta de contracts/integraciones.md (D110). Los nombres de campo son los del contrato.
export type IntegrationPurpose = 'measurement' | 'workflow';
export type IntegrationStatus = 'active' | 'pending' | 'needs_attention';
export type IntegrationAvailability = 'available' | 'coming_soon';

export interface CatalogIntegration {
  code: string;
  name: string;
  logo_key: string;
  purpose: IntegrationPurpose;
  availability: IntegrationAvailability;
  description: string;
  connection: { category: string; platform: string } | null;
  connected: boolean;
}

export interface IntegrationConnection {
  asset_id: string;
  code: string;
  name: string;
  connection_status: string;
  operational_status: string;
  needs_attention: boolean;
  services: { id: string; name: string }[];
}

export interface Integration {
  code: string;
  name: string;
  logo_key: string;
  purpose: IntegrationPurpose;
  status: IntegrationStatus;
  connection_count: number;
  resource_count: number;
  last_validated_at: string | null;
  connections: IntegrationConnection[];
}

// El detalle de una integración (GET /v1/integrations/{code}): el ítem del catálogo más lo de la empresa y el contenido de la página.
export type IntegrationSecurityTopic = 'read_only' | 'temporary_credentials' | 'external_id' | 'isolated_execution' | 'tenant_isolation' | 'encrypted_keys';
export type IntegrationPermissionAccess = 'read' | 'write';
export type ResourceKind = 'server' | 'database' | 'storage' | 'function' | 'other';

export interface IntegrationPermission {
  name: string;
  detail: string;
  scope: string | null;
  access: IntegrationPermissionAccess;
}

export interface IntegrationCoverage {
  tests: { code: string; name: string }[];
  controls_count: number;
  frameworks: { code: string; name: string; controls_count: number }[];
}

export interface IntegrationDetail extends CatalogIntegration {
  status: IntegrationStatus | null;
  connection_count: number;
  resource_count: number;
  last_validated_at: string | null;
  connections: IntegrationConnection[];
  overview: string;
  features: string[];
  prerequisites: string[];
  permissions: IntegrationPermission[];
  resource_types: ResourceKind[];
  coverage: IntegrationCoverage | null;
  security: { topic: IntegrationSecurityTopic; text: string }[];
  capabilities: string[];
  works_with: string[];
}
