export interface CreateOnboardingAdminDto {
  api_key: string;
  email: string;
  username: string;
  password: string;
  name?: string;
  last_name?: string;
}

export type BusinessType = 'E_COMMERCE' | 'FINTECH' | 'SAAS' | 'HEALTHTECH' | 'OTHER';

export interface UpsertCompanyProfileDto {
  business_type?: BusinessType;
  server_count?: number;
}

export interface CompanyProfile {
  business_type?: BusinessType;
  server_count?: number;
}
