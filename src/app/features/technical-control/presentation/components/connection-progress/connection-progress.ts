import { ChangeDetectionStrategy, Component, computed, effect, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SLOW_AFTER_SECONDS, estimateProgress } from '../execution-progress/execution-progress';

// Lo que se ve mientras se comprueba la conexión con la cuenta de la nube y se traen sus servidores (puede tardar unos 6 minutos): un porcentaje grande, una barra, en qué paso va y
// cuánto lleva, para que quien espera sepa que avanza y no que se cayó. Es una ESTIMACIÓN por tiempo y así se dice: el servidor solo responde cuando termina. La pieza vive mientras
// dura la espera y su reloj empieza cuando aparece; al desaparecer, ya hay resultado. Habla de «tu cuenta», nunca de proveedores del motor.
@Component({
  selector: 'app-connection-progress',
  imports: [TranslatePipe],
  templateUrl: './connection-progress.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionProgress {
  private readonly now = signal(Date.now());
  private readonly seenAt = Date.now();

  readonly elapsed = computed(() => Math.max(0, Math.floor((this.now() - this.seenAt) / 1000)));
  readonly percent = computed(() => estimateProgress(this.elapsed(), 'running'));
  readonly stage = computed(() => {
    const p = this.percent();
    return p < 10 ? 'ACCESS' : p < 45 ? 'READ' : p < 80 ? 'REGIONS' : 'LIST';
  });
  readonly slow = computed(() => this.elapsed() >= SLOW_AFTER_SECONDS);
  readonly clock = computed(() => {
    const s = this.elapsed();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  constructor() {
    effect((onCleanup) => {
      const id = setInterval(() => untracked(() => this.now.set(Date.now())), 1000);
      onCleanup(() => clearInterval(id));
    });
  }
}
