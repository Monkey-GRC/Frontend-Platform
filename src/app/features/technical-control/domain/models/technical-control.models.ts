// contracts/modules/onboarding-technical-control.md
// Nada aquí nombra al proveedor del motor de monitoreo: al cliente se le habla de «sonda» y de
// «evaluación automática».

// Lo que el cliente elige al conectar (D67): un proveedor de nube, un sistema operativo o un motor de base de datos. Solo se elige la `available`; la
// `coming_soon` se muestra bloqueada. `logo_key` es el nombre del SVG en `public/providers/`. `name` es la marca y no se traduce.
export interface Platform {
  code: string;
  name: string;
  logo_key: string;
  availability: 'available' | 'coming_soon';
  // Canales con los que se conecta; el primero es el recomendado. Vacío si aún no tiene canal.
  connection_methods: ConnectionMethod[];
}

export interface Capability {
  catalog_code: string;
  category: string;
  method: string;
  required_permissions: string[];
  base_frequency: string;
  platforms: Platform[];
  generated_evidence: string;
}

// `runner`: la conexión se comprueba DE VERDAD contra la cuenta del cliente (D58). `simulated` es demostración; `unavailable`, aún sin evaluación automática.
export type ProbeMode = 'simulated' | 'unavailable' | 'runner';

export type ConnectionMethod = 'readonly_role' | 'access_keys' | 'agent';

// Lo que el cliente necesita para completar la conexión. Sin secretos: el identificador externo lo genera Monkey y las llaves nunca vuelven.
// Los pasos ya llegan traducidos (la plataforma no tiene i18n propio).
export interface ConnectionSetup {
  method: ConnectionMethod;
  external_id?: string;
  monkey_principal_arn?: string | null;
  role_name?: string;
  template_path?: string;
  role_arn?: string | null;
  warning?: string;
  steps: string[];
}

export interface TechnicalControlState {
  deployment_scenario: string | null;
  applicable_capabilities: Capability[];
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
  connection_method?: ConnectionMethod | null;
  regions?: string[];
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
  external_account_id?: string | null;
  connection_setup?: ConnectionSetup | null;
  services: { id: string; name: string }[];
  provisioning: AssetProvisioning;
}

// Editar un sistema: todo es opcional. Lo que cambia la conexión (cuenta, regiones, rol, llaves) la devuelve a «pendiente».
export interface UpdateAssetInput {
  name?: string;
  criticality?: string;
  external_account_id?: string;
  regions?: string[];
  role_arn?: string;
  credentials?: Record<string, string>;
}

// Un activo que la conexión reconoció dentro de la cuenta del cliente (D61). Los atributos son solo lo que se pudo leer.
export type ResourceAttributes = Record<string, string | number | boolean | null>;
export interface DiscoveredAsset {
  id: string;
  code: string;
  kind: string;
  type: string;
  name: string | null;
  region: string | null;
  platform: string;
  ip_address: string | null;
  location: string | null;
  criticality: string;
  tags: string[];
  attributes: ResourceAttributes;
  // Si pertenece al servicio por el que se preguntó.
  in_service: boolean | null;
}

export interface DiscoveredAssetsPage {
  // Nulo mientras la cuenta no se haya descubierto: la lista viene vacía y no es un error.
  discovered_at: string | null;
  regions: string[];
  // Servicios que no se pudieron leer: el cliente ve «incompleto», no «vacío».
  incomplete_services: string[];
  summary: { kind: string; count: number }[];
  included_count: number | null;
  items: DiscoveredAsset[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
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
  probe_mode?: ProbeMode;
}

// Una evaluación (no una comprobación de conexión): en cola → en curso → completada o fallida.
export interface Execution {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  origin: 'scheduled' | 'manual';
  queued_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  // Clave del motivo (connection.role_not_found…); el texto del cliente lo resuelve la pantalla.
  failure_reason: string | null;
  // El mismo motivo, ya en el idioma del cliente.
  failure_message: string | null;
}

export interface ExecutionPage {
  items: Execution[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
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
  // Conexión de nube (D53): canal, cuenta y regiones declaradas. Sin `connection_method` rige el formulario provisional.
  connection_method?: ConnectionMethod;
  external_account_id?: string;
  regions?: string[];
}

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
