import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { COMPLIANCE_ROUTE } from '../../../domain/models/compliance.models';
import { RiskListItem } from '../../../domain/models/risk.models';
import { RiskLevelBadge, riskLevelLook } from '../risk-level-badge/risk-level-badge';

interface Cell {
  likelihood: number;
  impact: number;
  risks: RiskListItem[];
}

// La matriz inherente del servicio (D76): dónde cae cada riesgo evaluado, por probabilidad e impacto, con cuántos hay en cada casilla. No decide si un riesgo está
// mitigado (eso lo dicen los controles y sus pruebas) ni promedia: un promedio escondería el riesgo crítico. Los niveles los calcula el servidor al evaluar; la matriz no los
// recalcula, así que una casilla vacía es neutra y la ocupada toma el nivel que el servidor le dio a sus riesgos. Los riesgos sin evaluar no están en la matriz: se cuentan aparte.
// La residual no está: espera los datos de la fórmula (P22, MD-151).
@Component({
  selector: 'app-risk-heatmap',
  imports: [TranslatePipe, RouterLink, RiskLevelBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './risk-heatmap.html',
})
export class RiskHeatmap {
  private readonly translate = inject(TranslateService);
  private readonly catalogs = inject(CatalogService);

  readonly risks = input.required<RiskListItem[]>();
  readonly serviceId = input.required<string>();

  // La escala (hoy 1 a 5) y los niveles, con su orden de menor a mayor, los sirve el backend.
  private readonly scale = toSignal(this.catalogs.options('risk_scale'), { initialValue: [] });
  private readonly levels = toSignal(this.catalogs.options('risk_level'), { initialValue: [] });

  readonly likelihoods = computed(() => this.scale().map((o) => Number(o.value)).sort((a, b) => b - a));
  readonly impacts = computed(() => this.scale().map((o) => Number(o.value)).sort((a, b) => a - b));
  protected readonly columns = computed(() => `1.25rem repeat(${this.impacts().length}, 3rem)`);

  readonly picked = signal<{ likelihood: number; impact: number } | null>(null);

  readonly evaluated = computed(() => this.risks().filter((r) => r.likelihood !== null && r.impact !== null));
  readonly notEvaluated = computed(() => this.risks().length - this.evaluated().length);

  private readonly cells = computed(() => {
    const map = new Map<string, Cell>();
    for (const r of this.evaluated()) {
      const key = `${r.likelihood}-${r.impact}`;
      const cell = map.get(key) ?? { likelihood: r.likelihood as number, impact: r.impact as number, risks: [] };
      cell.risks.push(r);
      map.set(key, cell);
    }
    return map;
  });

  /** El nivel más alto que hay entre los riesgos evaluados (no un promedio); `null` si ninguno está evaluado. */
  readonly worstLevel = computed<string | null>(() => {
    const order = this.levels().map((o) => o.value);
    const present = this.evaluated().map((r) => r.inherent_risk_level).filter((l): l is string => l !== null);
    if (present.length === 0) return null;
    return present.reduce((worst, l) => (order.indexOf(l) > order.indexOf(worst) ? l : worst));
  });

  readonly selectedRisks = computed<RiskListItem[]>(() => {
    const p = this.picked();
    return p ? (this.cells().get(`${p.likelihood}-${p.impact}`)?.risks ?? []) : [];
  });

  readonly riskLink = computed(() => ['/services', this.serviceId(), COMPLIANCE_ROUTE, 'riesgos']);
  readonly riskQuery = (id: string) => ({ abrir: id });

  protected count(l: number, i: number): number {
    return this.cells().get(`${l}-${i}`)?.risks.length ?? 0;
  }

  /** El color de una casilla ocupada sale del nivel que el servidor dio a sus riesgos. */
  protected chip(l: number, i: number): string {
    return riskLevelLook(this.cells().get(`${l}-${i}`)?.risks[0]?.inherent_risk_level).chip;
  }

  protected isPicked(l: number, i: number): boolean {
    const p = this.picked();
    return !!p && p.likelihood === l && p.impact === i;
  }

  protected label(l: number, i: number): string {
    return this.translate.instant('COMPLIANCE.HEATMAP.CELL_ARIA', { likelihood: l, impact: i, count: this.count(l, i) });
  }

  protected pick(l: number, i: number): void {
    if (this.count(l, i) === 0) return;
    this.picked.set(this.isPicked(l, i) ? null : { likelihood: l, impact: i });
  }
}
