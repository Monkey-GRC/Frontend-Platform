export type BusinessType = 'E_COMMERCE' | 'FINTECH' | 'SAAS' | 'HEALTHTECH' | 'OTHER';

export interface UpsertCompanyProfileDto {
  business_type?: BusinessType;
  server_count?: number;
}

export interface CompanyProfile {
  business_type?: BusinessType;
  server_count?: number;
}

export interface OnboardingMasterTemplate {
  id: string;
  name: string;
  code: string;
  description?: string;
  objective?: string;
  scope?: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface CompleteOnboardingDto {
  onboarding_code: string;
  template_id?: string;
  email: string;
  username: string;
  password: string;
  name?: string;
  last_name?: string;
  business_type?: BusinessType;
  server_count?: number;
}

export interface CompleteOnboardingUser {
  id: string;
  email: string;
  username: string;
  name?: string;
  last_name?: string;
  role: string;
  client_id: string;
  is_active: boolean;
}

export interface CompleteOnboardingResult {
  user: CompleteOnboardingUser;
  client_identifier: string;
  client_key: string;
}
