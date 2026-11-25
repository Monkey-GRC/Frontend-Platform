import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { Coverage, ControlTechnical, Progress } from '@features/compliance/domain/models/control.models';
import { levelTone } from '@features/compliance/domain/utils/control-v2-look';
import { ReadinessLook } from '@shared/domain/utils/readiness-look';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { formatPercent, percentOf } from '@shared/domain/utils/percentage';
import { Donut } from '@shared/presentation/components/donut/donut';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';

/** Los seis niveles de la escala 0 a 5 (R1 a R6). */
const SCALE = [0, 1, 2, 3, 4, 5] as const;
type ScoreCell = 'status' | 'level' | 'coverage';

const FILL: Record<string, string> = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', neutral: 'bg-neutral' };

// El estado, el porcentaje, el nivel y la cobertura de un control, juntos en una sola pieza (nunca un porcentaje solo). En la vista técnica el centro de la dona
// es el C% y se agrega el nivel 0–5; en la de negocio es el avance, sin nivel. Todo viene calculado por el backend.
@Component({
  selector: 'app-control-score',
  imports: [TranslatePipe, Donut, StatusIndicator],
  templateUrl: './control-score.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlScore {
  protected readonly labels = inject(EnumLabelService);
  private readonly language = inject(LanguageService);
  protected readonly scale = SCALE;
  protected readonly levelTone = levelTone;

  readonly look = input.required<ReadinessLook>();
  readonly progress = input.required<Progress>();
  readonly coverage = input.required<Coverage>();
  readonly technical = input<ControlTechnical | null | undefined>(null);

  /** El % de la dona. Sin medir (o sin requisitos) no hay porcentaje: la dona muestra «—», nunca un 0 % (MD-499). */
  protected readonly percent = computed(() => (this.look().level === 'not_measured' ? null : percentOf(this.progress().done, this.progress().total)));
  protected readonly percentText = computed(() => formatPercent(this.percent(), this.language.current()));
  protected readonly coveragePercent = computed(() => formatPercent(percentOf(this.coverage().measured, this.coverage().applicable), this.language.current()));
  protected readonly fill = computed(() => FILL[levelTone(this.technical()?.level)] ?? 'bg-neutral');
  /** Las columnas de la cabecera: 3 en la vista técnica; sin nivel en la de negocio. */
  protected readonly cells = computed(() => (this.technical()?.level ? ['status', 'level', 'coverage'] : ['status', 'coverage']) as ScoreCell[]);
  /** El cierre de ventana más próximo (hoy o después) de las pruebas de sus requisitos, ya en el idioma de la sesión; `null` si no hay. */
  protected readonly nextWindow = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    const ends = (this.technical()?.requirements ?? []).flatMap((r) => r.tests.map((t) => t.window_end)).filter((d): d is string => !!d && d >= today).sort();
    if (!ends.length) return null;
    return formatLocalDate(ends[0], this.language.current(), { calendar: true }) || ends[0];
  });

  /** Las líneas finas entre columnas: vertical entre vecinas de una fila; en 2×2 (estrecho), además horizontal entre las dos filas. */
  protected dividers(i: number): string {
    // Dos columnas: línea entre las dos. Tres: en fila desde 42 rem (línea a la izquierda de la 2.ª y la 3.ª); más estrecho, la 3.ª baja a una segunda fila con
    // una línea horizontal encima.
    if (this.cells().length < 3) return i > 0 ? 'border-l border-line' : '';
    if (i === 0) return '';
    if (i === 1) return 'border-l border-line';
    return 'border-t border-line pt-4 mt-3 @2xl:mt-0 @2xl:border-t-0 @2xl:pt-1 @2xl:border-l';
  }

  protected readonly donutTone = computed(() => {
    const tone = this.technical()?.level ? levelTone(this.technical()?.level) : this.look().tone;
    return tone === 'ok' || tone === 'warn' || tone === 'bad' ? tone : 'neutral';
  });
}
