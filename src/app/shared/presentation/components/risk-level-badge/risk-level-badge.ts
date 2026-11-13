import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { StatusTone } from '@shared/domain/models/status-tone.model';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { Badge } from '../badge/badge';

// Nivel de un riesgo en la matriz 5×5: Bajo 1–4 · Moderado 5–9 · Alto 10–16 · Crítico 17–25 (enums.md `risk_level`). Se pinta con `app-badge` de estado y el tono de la escala
// de riesgo (`risk-low|moderate|high|critical`, con sus tokens: no son los de estado `ok|warn|bad`); el nivel nunca va solo en color: el badge lleva su palabra.
// Un riesgo sin evaluar (`null`) no es «bajo»: es que la empresa aún no lo evalúa, y se pinta neutro.
const TONES: Record<string, StatusTone> = { low: 'risk-low', moderate: 'risk-moderate', high: 'risk-high', critical: 'risk-critical' };

/** El tono de un nivel; un riesgo sin evaluar (o un nivel desconocido) sale neutro. */
export function riskLevelTone(level: string | null | undefined): StatusTone {
  return TONES[level ?? ''] ?? 'neutral';
}

// El mapa de calor (de lo mejor a lo peor, con los tokens de la escala de riesgo). Cada casilla tiene dos tonos: el suave pinta la casilla vacía y el intenso la que tiene
// riesgos, así que lo ocupado se distingue de un vistazo. El color nunca va solo: la casilla lleva su número y, fuera de ella, la leyenda con el nombre de cada nivel.
const HEAT: Record<string, { soft: string; solid: string }> = {
  low: { soft: 'border-risk-low/30 bg-risk-low-bg text-risk-low-ink', solid: 'border-risk-low bg-risk-low text-risk-low-on' },
  moderate: { soft: 'border-risk-moderate/50 bg-risk-moderate-bg text-risk-moderate-ink', solid: 'border-risk-moderate bg-risk-moderate text-risk-moderate-on' },
  high: { soft: 'border-risk-high/30 bg-risk-high-bg text-risk-high-ink', solid: 'border-risk-high bg-risk-high text-risk-high-on' },
  critical: { soft: 'border-risk-critical/30 bg-risk-critical-bg text-risk-critical-ink', solid: 'border-risk-critical bg-risk-critical text-risk-critical-on' },
};
const HEAT_NEUTRAL = { soft: 'border-line bg-canvas text-ink-muted', solid: 'border-neutral bg-neutral text-ink' };

/** Los dos tonos de una casilla del mapa de calor según su nivel; un nivel desconocido (o sin dato) sale neutro. */
export function riskLevelHeat(level: string | null | undefined): { soft: string; solid: string } {
  return HEAT[level ?? ''] ?? HEAT_NEUTRAL;
}

@Component({
  selector: 'app-risk-level-badge',
  imports: [TranslatePipe, Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex max-w-full align-middle' },
  template: `
    <app-badge kind="status" size="sm" [tone]="tone()" [attr.data-level]="level() ?? 'none'">
      @if (level(); as l) {
        {{ labels.of('COMPLIANCE.RISK_LEVEL', l) }}
      } @else {
        {{ 'COMPLIANCE.RISKS.NOT_EVALUATED' | translate }}
      }
    </app-badge>
  `,
})
export class RiskLevelBadge {
  protected readonly labels = inject(EnumLabelService);
  readonly level = input<string | null | undefined>(null);
  protected readonly tone = computed(() => riskLevelTone(this.level()));
}
