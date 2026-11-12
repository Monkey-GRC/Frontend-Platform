import { canDeclareCompanyContext } from '@shared/domain/utils/roles';

// Adónde va quien acaba de entrar. El contexto de la empresa lo declara solo quien puede (el backend responde 403 al resto):
// únicamente a él se le lleva al onboarding; los demás roles van al inicio.
export const postLoginPath = (role: string | null | undefined, onboarding: { next_step: string | null } | null | undefined): string =>
  canDeclareCompanyContext(role) && onboarding?.next_step === 'organizational_context' ? '/onboarding' : '/';
