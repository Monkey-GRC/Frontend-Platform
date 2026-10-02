// contracts/modules/onboarding-organizational-context.md

export interface RegulationRef {
  code: string;
  name: string;
  jurisdiction: string;
}

export interface OrganizationalContext {
  id: string | null;
  name: string;
  description: string | null;
  size: string | null;
  industry: string | null;
  business_model: string | null;
  years_in_operation: string | null;
  incorporation_countries: string[];
  client_countries: string[];
  compliance_maturity: string | null;
  regulations: RegulationRef[];
  completion: {
    required_total: number;
    required_filled: number;
    optional_total: number;
    optional_filled: number;
  };
  is_complete: boolean;
}

// Lo que se envía con PUT. No lleva `name`: la razón social es solo lectura.
export interface OrganizationalContextInput {
  description: string;
  size: string;
  industry: string;
  business_model: string;
  years_in_operation: string | null;
  incorporation_countries: string[];
  client_countries: string[];
  compliance_maturity: string;
  regulation_codes: string[];
}

// Las respuestas del cliente mientras las escribe (aún sin validar).
export interface OrganizationalContextDraft {
  description: string;
  size: string | null;
  years_in_operation: string | null;
  industry: string | null;
  business_model: string | null;
  incorporation_countries: string[];
  client_countries: string[];
  compliance_maturity: string | null;
  regulation_codes: string[];
}

export const emptyDraft = (): OrganizationalContextDraft => ({
  description: '',
  size: null,
  years_in_operation: null,
  industry: null,
  business_model: null,
  incorporation_countries: [],
  client_countries: [],
  compliance_maturity: null,
  regulation_codes: [],
});

export const draftFromContext = (ctx: OrganizationalContext): OrganizationalContextDraft => ({
  description: ctx.description ?? '',
  size: ctx.size,
  years_in_operation: ctx.years_in_operation,
  industry: ctx.industry,
  business_model: ctx.business_model,
  incorporation_countries: [...ctx.incorporation_countries],
  client_countries: [...ctx.client_countries],
  compliance_maturity: ctx.compliance_maturity,
  regulation_codes: ctx.regulations.map((r) => r.code),
});
