// Opciones que sirve el backend (GET /v1/catalogs/{name}). El frontend no escribe estas listas a
// mano: el valor es el que viaja al guardar y la etiqueta ya viene en el idioma de la sesión.
export interface CatalogOption {
  value: string;
  label: string;
  // Solo en las listas de países: `eu` es una región y `other` es "Otro". En los países del
  // servicio, además, `latam` y `global` son región.
  group?: 'country' | 'region' | 'other' | string;
  // Solo en las versiones de un sistema operativo (`<sistema>_version`): `group` es la distribución y `group_label` su nombre ya traducido.
  group_label?: string;
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

// Etiquetas de una opción de conexión (`connection_option_tag`); su texto es de i18n.
export type OptionTag = 'recommended' | 'fastest' | 'advanced' | 'less_secure';

// Una opción de un asistente de conexión (D114): la sirve el backend con su explicación, si ya se puede elegir y sus etiquetas. Las `coming_soon` se muestran bloqueadas.
export interface ConnectionOption {
  value: string;
  label: string;
  description: string;
  availability: 'available' | 'coming_soon';
  tags: OptionTag[];
}

export type ConnectionOptionName = 'connection_method' | 'gcp_connection_scope' | 'gcp_setup_method';

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
  | 'asset_criticality'
  | 'gap_priority'
  | 'schedule_frequency'
  // Conexión de nube (D53, D58)
  | ConnectionOptionName
  | 'aws_region'
  | 'resource_kind'
  // Cumplimiento (compliance-catalogs.ts del Backend): salen de los enums de Postgres
  | 'dimension'
  | 'risk_criterion'
  | 'failure_category'
  | 'cause_origin'
  | 'cause_type'
  | 'periodicity'
  | 'risk_level'
  | 'risk_treatment_decision'
  | 'responsible_type'
  | 'cause_control_effect'
  | 'exclusion_status'
  | 'control_type'
  | 'control_management_state'
  | 'manual_test_result_value'
  | 'control_level'
  | 'requirement_status'
  | 'management_history_type'
  | 'work_decision_kind'
  | 'requirement_applicability'
  | 'change_request_status'
  | 'catalog_origin'
  | 'loss_type'
  | 'risk_scale'
  // Integraciones (D110): el orden de las secciones y de los filtros es el del catálogo
  | 'integration_status'
  | 'integration_purpose'
  // Avisos (contracts/notificaciones.md) y Documentos (contracts/documentos.md)
  | 'notification_type'
  | 'document_type'
  | 'document_acceptance'
  | 'my_document_status'
  // Las regiones de una plataforma (`aws_region`…) salen de la base (D67): una plataforma nueva con regiones no exige cambiar esta lista.
  | `${string}_region`
  // Las versiones que se pueden declarar de un sistema operativo (`linux_version`, `windows_version`…, D112): también salen de la base.
  | `${string}_version`;
