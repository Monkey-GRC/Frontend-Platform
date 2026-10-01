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

// Un marco que se puede contratar (hoy solo SOC 2).
export interface FrameworkOption {
  code: string;
  name: string;
  description: string;
  label: string;
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
  | 'previous_certification';
