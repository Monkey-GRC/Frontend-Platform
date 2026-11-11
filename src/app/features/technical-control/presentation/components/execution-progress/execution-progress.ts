import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Execution } from '@shared/domain/models/technical-control.models';

/** Cuánto suele tardar una evaluación de una cuenta de nube, en segundos (unos 6 minutos). */
export const TYPICAL_SECONDS = 360;
/** Con qué rapidez se acerca la barra a su tope: a los 6 minutos va en ~86 %. */
const TAU_SECONDS = 150;
/** La barra no pasa de aquí mientras la evaluación siga abierta: el 100 % solo lo da el servidor al terminar. */
export const ESTIMATE_CAP = 95;
/** Pasado este tiempo se avisa que está tardando más de lo habitual. */
export const SLOW_AFTER_SECONDS = 720;

/** Avance estimado (0 a 95) según el tiempo que lleva. Es una estimación: el servidor solo dice «en cola», «en curso» o «terminada», no cuánto falta. */
export function estimateProgress(elapsedSeconds: number, status: Execution['status']): number {
  if (status === 'queued') return Math.min(3, Math.floor(ESTIMATE_CAP * (1 - Math.exp(-Math.max(0, elapsedSeconds) / TAU_SECONDS))));
  return Math.min(ESTIMATE_CAP, Math.floor(ESTIMATE_CAP * (1 - Math.exp(-Math.max(0, elapsedSeconds) / TAU_SECONDS))));
}

// Lo que se ve mientras una cuenta se evalúa (en cola o en curso): un porcentaje grande, una barra, en qué paso va y cuánto lleva, para que quien espera sepa que avanza y no que
// se cayó. El porcentaje es una ESTIMACIÓN por tiempo y así se dice; el 100 % solo aparece cuando el servidor confirma que terminó (entonces esta pieza desaparece).
// Habla de «evaluación automática», nunca de proveedores.
@Component({
  selector: 'app-execution-progress',
  imports: [TranslatePipe],
  templateUrl: './execution-progress.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutionProgress {
  readonly execution = input.required<Execution>();

  private readonly now = signal(Date.now());
  /** Desde cuándo se cuenta: el inicio que dice el servidor o, si aún no lo trae, desde que esta pieza lo vio. */
  private readonly seenAt = Date.now();

  readonly queued = computed(() => this.execution().status === 'queued');
  readonly elapsed = computed(() => {
    const e = this.execution();
    const from = e.started_at ?? e.queued_at;
    const start = from ? Date.parse(from) : this.seenAt;
    return Math.max(0, Math.floor((this.now() - (Number.isFinite(start) ? start : this.seenAt)) / 1000));
  });
  readonly percent = computed(() => estimateProgress(this.elapsed(), this.execution().status));
  readonly stage = computed(() => {
    if (this.queued()) return 'PREPARE';
    const p = this.percent();
    return p < 12 ? 'CONNECT' : p < 45 ? 'READ' : p < 80 ? 'CHECK' : 'RESULTS';
  });
  readonly slow = computed(() => this.elapsed() >= SLOW_AFTER_SECONDS);
  readonly clock = computed(() => {
    const s = this.elapsed();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  constructor() {
    // Un tic por segundo para el reloj y la barra; se detiene solo al desaparecer la pieza.
    effect((onCleanup) => {
      const id = setInterval(() => untracked(() => this.now.set(Date.now())), 1000);
      onCleanup(() => clearInterval(id));
    });
  }
}
