import type { StatusTone } from '@shared/domain/models/status-tone.model';
import type { CheckLink, CheckRole, ControlLevel, ControlRequirement, Periodicity } from '../models/control.models';

// Tonos del motor v2: el color nunca va solo (el texto del enum va junto). Solo Adecuado y Sólido cumplen (R4); un valor desconocido sale neutro.
const LEVEL_TONES: Record<ControlLevel, StatusTone> = {
  not_evaluated: 'neutral',
  ineffective: 'bad',
  weak: 'bad',
  partial: 'warn',
  adequate: 'ok',
  solid: 'ok',
};

const STATUS_TONES: Record<string, StatusTone> = {
  compliant: 'ok',
  correct: 'ok',
  non_compliant: 'bad',
  exception: 'bad',
  observation: 'warn',
  pending: 'warn',
  expired: 'warn',
  not_applicable: 'neutral',
};

const CHECK_ROLES: readonly CheckRole[] = ['direct', 'complementary', 'dependency'];

export function levelTone(level: string | null | undefined): StatusTone {
  return LEVEL_TONES[level as ControlLevel] ?? 'neutral';
}

/** Tono de un `requirement_status` o de un `test_status`. */
export function statusTone(status: string | null | undefined): StatusTone {
  return STATUS_TONES[status ?? ''] ?? 'neutral';
}

export interface RoleGroup {
  role: CheckRole;
  links: CheckLink[];
}

/** Los vínculos de una prueba agrupados por rol, en el orden Directo → Complementario → Dependencia; un rol sin vínculos no sale. */
export function groupByRole(links: readonly CheckLink[]): RoleGroup[] {
  return CHECK_ROLES.map((role) => ({ role, links: links.filter((l) => l.role === role) })).filter((g) => g.links.length > 0);
}

export interface RequirementsSummary {
  applicable: number;
  compliant: number;
  missing: number;
}

/** Cuántos requisitos aplican, cuántos cumplen y cuántos faltan (los No aplica salen). Solo cuenta lo que entrega el backend. */
export function summarizeRequirements(list: readonly ControlRequirement[]): RequirementsSummary {
  const applicable = list.filter((r) => r.status !== 'not_applicable');
  const compliant = applicable.filter((r) => r.status === 'compliant').length;
  return { applicable: applicable.length, compliant, missing: applicable.length - compliant };
}

export interface PeriodicitySummary {
  /** Las periodicidades distintas que tienen hoy los requisitos (normalmente una: se cambia por control, D147). */
  current: Periodicity[];
  /** Las que sugiere el catálogo. */
  suggested: Periodicity[];
  /** `true` si la organización cambió alguna (`periodicity_source = client`). */
  adjusted: boolean;
}

export function summarizePeriodicity(list: readonly ControlRequirement[]): PeriodicitySummary {
  const current = [...new Set(list.map((r) => r.periodicity))];
  const suggested = [...new Set(list.map((r) => r.suggested_periodicity ?? r.periodicity))];
  return { current, suggested, adjusted: list.some((r) => r.periodicity_source === 'client') };
}

/** Lo que resume `summarizePeriodicity` como texto («Mensual, Trimestral»), con la etiqueta traducida de cada periodicidad. */
export function periodicityText(summary: PeriodicitySummary, labels: { of(prefix: string, value: string): string }): { current: string; suggested: string } {
  const text = (list: readonly Periodicity[]) => list.map((p) => labels.of('COMPLIANCE.PERIODICITY', p)).join(', ');
  return { current: text(summary.current), suggested: text(summary.suggested) };
}
