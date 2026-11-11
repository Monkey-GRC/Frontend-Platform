import { Readiness, toReadiness } from '../models/readiness.models';

/** Tone of the design system (the same four as `app-status-indicator`). */
export type ReadinessTone = 'ok' | 'warn' | 'bad' | 'neutral';

export interface ReadinessLook {
  /** The level after normalising: an unknown value is `not_measured`. */
  level: Readiness;
  tone: ReadinessTone;
  labelKey: string;
  hintKey: string;
}

// Four levels, four tones. Colour never travels alone (the text goes with the dot in `app-status-indicator`), and «Sin medir» is neutral:
// it is not a failure, it is that there is no data yet, different from «Requiere trabajo».
const LOOKS: Record<Readiness, Omit<ReadinessLook, 'level'>> = {
  ready: { tone: 'ok', labelKey: 'COMMON.READINESS.LABEL.READY', hintKey: 'COMMON.READINESS.HINT.READY' },
  almost_ready: { tone: 'warn', labelKey: 'COMMON.READINESS.LABEL.ALMOST_READY', hintKey: 'COMMON.READINESS.HINT.ALMOST_READY' },
  needs_work: { tone: 'bad', labelKey: 'COMMON.READINESS.LABEL.NEEDS_WORK', hintKey: 'COMMON.READINESS.HINT.NEEDS_WORK' },
  not_measured: { tone: 'neutral', labelKey: 'COMMON.READINESS.LABEL.NOT_MEASURED', hintKey: 'COMMON.READINESS.HINT.NOT_MEASURED' },
};

/**
 * How a compliance readiness (`ready`, `almost_ready`, `needs_work`, `not_measured`, as the backend serves it) is shown with `app-status-indicator`:
 * tone, label key and the plain-language hint. A value it does not recognise is «Sin medir», never a failure.
 *
 *   @let look = readinessLook(row.readiness);
 *   <app-status-indicator [tone]="look.tone" [labelKey]="look.labelKey" [hintKey]="look.hintKey" [attr.data-status]="look.level" />
 */
export function readinessLook(status: unknown): ReadinessLook {
  const level = toReadiness(status);
  return { level, ...LOOKS[level] };
}
