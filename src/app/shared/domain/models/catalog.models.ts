// Opciones que sirve el backend (GET /v1/catalogs/{name}). El frontend no escribe estas listas a
// mano: el valor es el que viaja al guardar y la etiqueta ya viene en el idioma de la sesión.
export interface CatalogOption {
  value: string;
  label: string;
  // Solo en las listas de países: `eu` es una región y `other` es "Otro".
  group?: 'country' | 'region' | 'other';
}

export interface RegulationOption {
  code: string;
  name: string;
  jurisdiction: string;
  label: string;
}

export type CatalogName =
  | 'size'
  | 'industry'
  | 'business_model'
  | 'years_in_operation'
  | 'incorporation_country'
  | 'client_country'
  | 'compliance_maturity';
