import { ControlDimension, DimensionCompliance } from '@features/dashboard/domain/models/dashboard.models';

/**
 * Presentación compartida de las 5 dimensiones de un control (Política/
 * Servidor/BD/Nube/App) — usada tanto en el dashboard plano como en la
 * vista de árbol del template, para no duplicar (ni desincronizar) el
 * criterio visual: lo que cumple al 100% se ve compacto y neutro, lo que
 * no cumple se ve grande y con acento de alerta.
 */

const DIMENSION_META: Record<ControlDimension, { icon: string; label: string }> = {
  POLICY: { icon: 'description', label: 'Política' },
  SERVER: { icon: 'dns', label: 'Servidor' },
  DATABASE: { icon: 'database', label: 'Base de Datos' },
  CLOUD: { icon: 'cloud', label: 'Nube' },
  APP: { icon: 'apps', label: 'Aplicación' },
};

export function getDimensionMeta(dimension: ControlDimension): { icon: string; label: string } {
  return DIMENSION_META[dimension];
}

const DIMENSION_ORDER: ControlDimension[] = ['POLICY', 'SERVER', 'DATABASE', 'CLOUD', 'APP'];

export type DimensionSlot = { dimension: ControlDimension; data: DimensionCompliance | null };

/**
 * Siempre las 5 dimensiones, en el mismo orden — las que no vienen en la
 * respuesta del backend (no aplican a este control) quedan con `data: null`
 * y se pintan como "No aplica" (neutro, no cuenta a favor ni en contra).
 */
export function fillAllDimensions(present: DimensionCompliance[]): DimensionSlot[] {
  const byDimension = new Map(present.map((d) => [d.dimension, d]));
  return DIMENSION_ORDER.map((dimension) => ({ dimension, data: byDimension.get(dimension) ?? null }));
}

export function getDimensionSlotCardClasses(slot: DimensionSlot): string {
  if (!slot.data) return 'border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-800/20';
  return getDimensionCardClasses(slot.data);
}

export function getDimensionSlotIconWrapClasses(slot: DimensionSlot): string {
  if (!slot.data) return 'bg-gray-100 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500';
  return getDimensionIconWrapClasses(slot.data);
}

export function getDimensionSlotBadgeClasses(slot: DimensionSlot): string {
  if (!slot.data) return 'bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400';
  return getDimensionBadgeClasses(slot.data);
}

export function getDimensionSlotBadgeLabel(slot: DimensionSlot): string {
  if (!slot.data) return 'No aplica';
  return getDimensionBadgeLabel(slot.data);
}

export function isDimensionFullyCompliant(dimension: DimensionCompliance): boolean {
  return dimension.compliance === 100;
}

export function getDimensionCardClasses(dimension: DimensionCompliance): string {
  if (dimension.compliance === 100) {
    return 'border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/40';
  }
  return 'border-[1.5px] border-error-200 dark:border-error-500/30 bg-white dark:bg-gray-800/40';
}

export function getDimensionIconWrapClasses(dimension: DimensionCompliance): string {
  if (dimension.compliance === 100) {
    return 'bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-400';
  }
  return 'bg-error-50 dark:bg-error-500/10 text-error-700 dark:text-error-400';
}

export function getDimensionBadgeClasses(dimension: DimensionCompliance): string {
  if (dimension.compliance === 100) {
    return 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400';
  }
  if (dimension.compliance === 0) {
    return 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400';
  }
  return 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400';
}

export function getDimensionBadgeLabel(dimension: DimensionCompliance): string {
  if (dimension.compliance === 100) return 'Cumple';
  if (dimension.compliance === 0) return 'No cumple';
  return 'Parcial';
}

/** Mismos umbrales que el % de control (>=90 verde, >=60 ámbar, si no rojo) — para la barra de una dimensión. */
export function getPercentBarClass(percent: number): string {
  if (percent >= 90) return 'bg-success-500';
  if (percent >= 60) return 'bg-warning-500';
  return 'bg-error-500';
}

export function getPercentTextClass(percent: number): string {
  if (percent >= 90) return 'text-success-600 dark:text-success-400';
  if (percent >= 60) return 'text-warning-600 dark:text-warning-400';
  return 'text-error-600 dark:text-error-400';
}
