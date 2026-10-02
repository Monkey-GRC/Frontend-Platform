// contracts/modules/onboarding-technical-control.md
// Nada aquí nombra al proveedor del motor de monitoreo: al cliente se le habla de «sonda» y de
// «evaluación automática».

export interface Capability {
  catalog_code: string;
  category: string;
  method: string;
  required_permissions: string[];
  base_frequency: string;
  supported_platforms: string[];
  generated_evidence: string;
}

export interface ScopeCounts {
  server_count: number;
  cloud_count: number;
  app_count: number;
  database_count: number;
  endpoint_count: number;
}

export interface Scope extends ScopeCounts {
  id: string;
  declared_total: number;
  connected_total: number;
  connected: ScopeCounts;
}

export type ProbeMode = 'simulated' | 'unavailable';

export interface TechnicalControlState {
  deployment_scenario: string | null;
  applicable_capabilities: Capability[];
  scope: Scope | null;
  is_complete: boolean;
  probe_mode: ProbeMode;
}

export interface AssetProvisioning {
  id?: string;
  automated_capability_code?: string;
  connection_status: 'pending' | 'validated' | 'active' | 'scheduled' | 'failed';
  last_validated_at?: string | null;
  is_active: boolean;
  schedule_frequency: string | null;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  connection_category: string;
  type: string;
  platform?: string;
  ip_address?: string | null;
  location?: string | null;
  criticality?: string;
  operational_status: string;
  technical_coverage: string;
  services: { id: string; name: string }[];
  provisioning: AssetProvisioning;
}

export interface AssetPage {
  items: Asset[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ValidationResult {
  connection_status: string;
  last_validated_at: string | null;
  technical_coverage: string;
  checks_available: number;
  // «demo» mientras la evaluación sea simulada.
  mode: 'demo' | 'live';
}

// Lo que se envía al registrar un sistema.
export interface NewAssetInput {
  name: string;
  connection_category: string;
  platform: string;
  ip_address: string | null;
  location: string | null;
  criticality: string;
  service_ids: string[];
  credentials?: Record<string, string>;
}

export const SCOPE_FIELDS: { key: keyof ScopeCounts; label: string; help: string; icon: string }[] = [
  { key: 'server_count', label: 'Servidores', help: 'Máquinas que ejecutan tu servicio, en la nube o propias.', icon: 'dns' },
  { key: 'cloud_count', label: 'Servicios en la nube', help: 'Cuentas o suscripciones: AWS, Azure, Google, Microsoft 365…', icon: 'cloud' },
  { key: 'app_count', label: 'Aplicaciones', help: 'Los programas o sistemas que usan tus clientes o tu equipo.', icon: 'apps' },
  { key: 'database_count', label: 'Bases de datos', help: 'Donde se guarda la información de tu servicio.', icon: 'database' },
  { key: 'endpoint_count', label: 'Equipos de trabajo', help: 'Laptops y computadores de tu equipo.', icon: 'laptop_mac' },
];

export const emptyScope = (): Record<keyof ScopeCounts, string> => ({
  server_count: '',
  cloud_count: '',
  app_count: '',
  database_count: '',
  endpoint_count: '',
});

// Cuenta aproximada: vacío vale 0 (así nadie queda bloqueado por no saber un número exacto).
export const toCount = (value: string): number | null => {
  const text = value.trim();
  if (text === '') return 0;
  return /^\d{1,7}$/.test(text) ? Number(text) : null;
};

export const SCENARIO_HELP: Record<string, string> = {
  cloud_managed_only: 'Usas servicios como AWS, Microsoft 365 o Google Workspace, sin servidores propios.',
  cloud_with_servers: 'Tienes servidores o bases de datos alojados en la nube.',
  on_premise: 'Tus servidores, bases de datos y equipos están en tus propias oficinas o centro de datos.',
  hybrid: 'Una mezcla: algo en la nube y algo en tus propias instalaciones.',
};

export const SCENARIO_ICON: Record<string, string> = {
  cloud_managed_only: 'cloud',
  cloud_with_servers: 'cloud_sync',
  on_premise: 'domain',
  hybrid: 'hub',
};
