// Presentación pura: el icono de cada opción por su `value`. Una opción nueva del catálogo sin icono aquí se ve con el genérico, sin romper nada.
const OPTION_ICONS: Record<string, string> = {
  project: 'folder_open',
  organization: 'corporate_fare',
  cloud_shell: 'terminal',
  terraform: 'deployed_code',
  readonly_role: 'verified_user',
  access_keys: 'key',
  identity_federation: 'badge',
  agent: 'dns',
};

export const optionIcon = (value: string): string => OPTION_ICONS[value] ?? 'tune';
