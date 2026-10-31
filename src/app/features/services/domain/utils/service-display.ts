// Cómo se dibujan los valores de un servicio (países, datos que maneja…) en la revisión y en el detalle: una sola fuente para que las dos pantallas se vean igual.
// Las clases van completas para que Tailwind las encuentre.

// Banderas y símbolos de los países: se comparten con el onboarding (ver `shared/domain/utils/country-flags.ts`).
export { FLAG_FILES, SYMBOLS } from '@shared/domain/utils/country-flags';

export const DATA_ICONS: Record<string, string> = { pii: 'badge', payment: 'credit_card', phi: 'health_and_safety', business: 'business_center', files: 'folder', logs: 'receipt_long', credentials: 'key', biometric: 'fingerprint' };

export const CRITERION_STYLES: Record<string, { icon: string; chip: string }> = {
  security: { icon: 'shield', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/30' },
  availability: { icon: 'speed', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30' },
  confidentiality: { icon: 'lock', chip: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/30' },
  integrity: { icon: 'fact_check', chip: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/30' },
  privacy: { icon: 'visibility_off', chip: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/30' },
};
