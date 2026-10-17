// Opciones que sirve el backend (GET /v1/catalogs/{name}). El frontend no escribe estas listas a
// mano: el valor es el que viaja al guardar y la etiqueta ya viene en el idioma de la sesión.
export interface CatalogOption {
  value: string;
  label: string;
  // Solo en las listas de países: `eu` es una región y `other` es "Otro". En los países del
  // servicio, además, `latam` y `global` son región.
  group?: 'country' | 'region' | 'other';
}

export interface RegulationOption {
  code: string;
  name: string;
  jurisdiction: string;
  label: string;
}

// Un marco que Monkey ofrece. `available`: ya tiene catálogo y se puede contratar (hoy solo SOC 2);
// `coming_soon`: oferta comercial, todavía no se puede elegir (D50).
export interface FrameworkOption {
  code: string;
  name: string;
  description: string;
  label: string;
  availability: 'available' | 'coming_soon';
}

export type CatalogName =
  // Componente 1 — la empresa
  | 'size'
  | 'industry'
  | 'business_model'
  | 'years_in_operation'
  | 'incorporation_country'
  | 'client_country'
  | 'compliance_maturity'
  // Componente 2 — el servicio
  | 'service_type'
  | 'served_industry'
  | 'active_client_count'
  | 'service_country'
  | 'data_type'
  | 'trust_criterion'
  | 'subservice_type'
  | 'expected_availability'
  | 'previous_certification'
  // Componente 3 — el control técnico
  | 'deployment_scenario'
  | 'asset_criticality'
  | 'schedule_frequency'
  // Conexión de nube (D53, D58)
  | 'connection_method'
  | 'aws_region'
  | 'resource_kind'
  // Cumplimiento (compliance-catalogs.ts del Backend): salen de los enums de Postgres
  | 'risk_criterion'
  | 'failure_category'
  | 'risk_level'
  | 'risk_treatment_decision'
  | 'responsible_type'
  | 'cause_control_effect'
  | 'exclusion_status'
  | 'dimension'
  | 'control_type'
  | 'catalog_origin'
  | 'loss_type'
  | 'risk_scale'
  // Las regiones de una plataforma (`aws_region`…) salen de la base (D67): una plataforma nueva con regiones no exige cambiar esta lista.
  | `${string}_region`;
