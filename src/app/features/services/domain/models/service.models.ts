// contracts/modules/onboarding-service-context.md

export interface ServiceFrameworkRef {
  code: string;
  name: string;
  contracted_at: string;
  status: string;
  catalog_version: number;
  evaluation_period: string;
}

export interface SubserviceOrganization {
  id: string;
  type: string;
  provider: string | null;
  service_provided: string | null;
  responsibility: string | null;
}

// Enlace y/o archivo (D51): pueden venir los dos. El archivo no expone su llave; se baja con un enlace temporal.
export interface SystemDescription {
  id: string;
  url: string | null;
  file_name: string | null;
  sections: unknown[];
}

export interface Service {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  scope_statement: string;
  type: string;
  industries_served: string[];
  active_client_count: string | null;
  countries: string[];
  data_types: string[];
  trust_criteria: string[];
  frameworks: ServiceFrameworkRef[];
  subservice_organizations: SubserviceOrganization[];
  previous_certification: string | null;
  expected_availability: string;
  system_description: SystemDescription | null;
  catalog: {
    status: 'ready' | 'processing';
    applicable_requirements: number;
    cloned_controls: number;
    message: string;
  };
  completion: {
    required_total: number;
    required_filled: number;
    optional_total: number;
    optional_filled: number;
  };
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

// Cada elemento de GET /v1/services.
export interface ServiceListItem {
  id: string;
  name: string;
  type: string;
  is_complete: boolean;
  frameworks: { code: string; status: string }[];
  catalog: { status: 'ready' | 'processing'; cloned_controls: number };
  // Componente 3: el escenario de despliegue y cuántas conexiones tiene registradas.
  technical_control: { deployment_scenario: string | null; is_complete: boolean; connection_count: number };
  created_at: string;
}

export interface ServicePage {
  items: ServiceListItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

// Lo que se envía con POST / PATCH.
export interface ServiceInput {
  name: string;
  description: string;
  scope_statement: string;
  type: string;
  industries_served: string[];
  active_client_count: string | null;
  countries: string[];
  data_types: string[];
  trust_criteria: string[];
  subservice_organizations: {
    type: string;
    provider: string | null;
    service_provided: string | null;
    responsibility: string | null;
  }[];
  framework_codes: string[];
  previous_certification: string | null;
  expected_availability: string;
  // Opcional: con archivo, el servicio se crea y el archivo se sube a continuación (D51).
  system_description?: { kind: 'link'; url: string };
}

// Las respuestas del cliente mientras las escribe (aún sin validar).
export interface SubserviceDraft {
  type: string;
  provider: string;
  service_provided: string;
  responsibility: string;
}

export interface ServiceDraft {
  name: string;
  description: string;
  scope_statement: string;
  type: string | null;
  industries_served: string[];
  active_client_count: string | null;
  countries: string[];
  data_types: string[];
  expected_availability: string | null;
  trust_criteria: string[];
  framework_codes: string[];
  subservices: SubserviceDraft[];
  previous_certification: string | null;
  system_description_url: string;
}

export const SECURITY = 'security';
export const ALL_TRUST_CRITERIA = ['security', 'availability', 'confidentiality', 'integrity', 'privacy'];

export const emptyServiceDraft = (): ServiceDraft => ({
  name: '',
  description: '',
  scope_statement: '',
  type: null,
  industries_served: [],
  active_client_count: null,
  countries: [],
  data_types: [],
  expected_availability: null,
  // `security` es obligatorio siempre: parte marcado y no se puede quitar.
  trust_criteria: [SECURITY],
  framework_codes: [],
  subservices: [],
  previous_certification: null,
  system_description_url: '',
});

export const draftFromService = (s: Service): ServiceDraft => ({
  name: s.name,
  description: s.description,
  scope_statement: s.scope_statement,
  type: s.type,
  industries_served: [...s.industries_served],
  active_client_count: s.active_client_count,
  countries: [...s.countries],
  data_types: [...s.data_types],
  expected_availability: s.expected_availability,
  trust_criteria: [...s.trust_criteria],
  framework_codes: s.frameworks.filter((f) => f.status === 'active').map((f) => f.code),
  subservices: s.subservice_organizations.map((o) => ({
    type: o.type,
    provider: o.provider ?? '',
    service_provided: o.service_provided ?? '',
    responsibility: o.responsibility ?? '',
  })),
  previous_certification: s.previous_certification,
  system_description_url: s.system_description?.url ?? '',
});

const orNull = (value: string): string | null => value.trim() || null;

// El formulario completo ya validado, listo para enviar.
export const inputFromDraft = (d: ServiceDraft): ServiceInput => ({
  name: d.name.trim(),
  description: d.description.trim(),
  scope_statement: d.scope_statement.trim(),
  type: d.type!,
  industries_served: d.industries_served,
  active_client_count: d.active_client_count,
  countries: d.countries,
  data_types: d.data_types,
  trust_criteria: d.trust_criteria,
  subservice_organizations: d.subservices.map((s) => ({
    type: s.type,
    provider: orNull(s.provider),
    service_provided: orNull(s.service_provided),
    responsibility: orNull(s.responsibility),
  })),
  framework_codes: d.framework_codes,
  previous_certification: d.previous_certification,
  expected_availability: d.expected_availability!,
  // El archivo no viaja aquí: se sube aparte, cuando el servicio ya existe.
  ...(d.system_description_url.trim()
    ? { system_description: { kind: 'link' as const, url: d.system_description_url.trim() } }
    : {}),
});

export const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// Archivo de la Descripción del Sistema: PDF o Word, hasta 25 MB (contrato del Componente 2).
export const SYSTEM_DESCRIPTION_MAX_BYTES = 25 * 1024 * 1024;
// Devuelve la clave de traducción del problema (services.json), o null si el archivo sirve.
export const systemDescriptionFileError = (file: File): string | null => {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.pdf') && !name.endsWith('.docx')) return 'SERVICES.FORM.FILE_ERROR_TYPE';
  if (file.size > SYSTEM_DESCRIPTION_MAX_BYTES) return 'SERVICES.FORM.FILE_ERROR_SIZE';
  if (file.size === 0) return 'SERVICES.FORM.FILE_ERROR_EMPTY';
  return null;
};
