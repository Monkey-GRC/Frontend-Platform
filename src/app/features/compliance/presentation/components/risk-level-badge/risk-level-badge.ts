import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EnumLabelService } from '../../../domain/services/enum-label.service';

interface Look {
  icon: string;
  chip: string;
}

// Nivel de un riesgo en la matriz 5×5: Bajo 1–4 · Moderado 5–9 · Alto 10–16 · Crítico 17–25 (enums.md `risk_level`). El color nunca va solo: cada nivel lleva su
// ícono y su texto. Un riesgo sin evaluar (`null`) no es «bajo»: es que la empresa aún no lo evalúa, y se pinta neutro con borde punteado.
const LOOKS: Record<string, Look> = {
  low: { icon: 'check_circle', chip: 'bg-green-50 text-green-800 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-400/30' },
  moderate: { icon: 'info', chip: 'bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-600/25 dark:bg-yellow-900/30 dark:text-yellow-300 dark:ring-yellow-400/30' },
  high: { icon: 'warning', chip: 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/25 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-400/30' },
  critical: { icon: 'error', chip: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-400/30' },
};
const UNEVALUATED: Look = { icon: 'hourglass_empty', chip: 'bg-transparent text-gray-700 border border-dashed border-gray-400 dark:text-gray-300 dark:border-gray-500' };

/** El aspecto (ícono y clases de color) de un nivel; un riesgo sin evaluar (o un nivel desconocido) sale neutro. Lo comparten la etiqueta y la matriz 5×5. */
export function riskLevelLook(level: string | null | undefined): Look {
  return LOOKS[level ?? ''] ?? UNEVALUATED;
}

@Component({
  selector: 'app-risk-level-badge',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium" [class]="look().chip" [attr.data-level]="level() ?? 'none'">
      <span class="material-symbols-rounded text-[14px] leading-none" aria-hidden="true">{{ look().icon }}</span>
      @if (level(); as l) {
        {{ labels.of('COMPLIANCE.RISK_LEVEL', l) }}
      } @else {
        {{ 'COMPLIANCE.RISKS.NOT_EVALUATED' | translate }}
      }
    </span>
  `,
})
export class RiskLevelBadge {
  protected readonly labels = inject(EnumLabelService);
  readonly level = input<string | null | undefined>(null);
  protected readonly look = computed(() => LOOKS[this.level() ?? ''] ?? UNEVALUATED);
}
