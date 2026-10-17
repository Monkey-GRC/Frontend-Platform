import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { COMPLIANCE_ROUTE } from '../../../domain/models/compliance.models';
import { RiskListItem, RiskMatrixData } from '../../../domain/models/risk.models';
import { RiskService } from '../../../domain/services/risk.service';
import { RiskLevelBadge, riskLevelHeat } from '../risk-level-badge/risk-level-badge';

interface Cell {
  likelihood: number;
  impact: number;
  risks: RiskListItem[];
}

// La matriz inherente del servicio (D76): un mapa de calor de 5×5 (verde lo mejor, rojo lo peor) con dónde cae cada riesgo evaluado, por probabilidad e impacto. No decide si un
// riesgo está mitigado (eso lo dicen los controles y sus pruebas) ni promedia: un promedio escondería el riesgo crítico. El nivel de CADA casilla lo sirve el backend
// (`GET /risk-matrix`, la misma función que evalúa un riesgo), así que aquí no hay cortes escritos a mano: si la matriz no llega, una casilla ocupada toma el nivel que el servidor
// dio a sus riesgos y las vacías quedan neutras. Los riesgos sin evaluar no están en la matriz: se cuentan aparte. La residual no está: espera los datos de la fórmula (P22, MD-151).
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

  // La escala (hoy 1 a 5) y los niveles, con su orden de menor a mayor, los sirve el backend; el nivel de cada casilla, también.
  private readonly scale = toSignal(this.catalogs.options('risk_scale'), { initialValue: [] });
  private readonly levels = toSignal(this.catalogs.options('risk_level'), { initialValue: [] });
  private readonly matrix = toSignal(inject(RiskService).matrix().pipe(catchError(() => of(null as RiskMatrixData | null))), { initialValue: null as RiskMatrixData | null });

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

  private readonly served = computed(() => new Map((this.matrix()?.cells ?? []).map((c) => [`${c.likelihood}-${c.impact}`, c])));

  /** La leyenda: cada nivel, de menor a mayor, con su color y el nombre que sirve el backend. */
  readonly legend = computed(() => this.levels().map((o) => ({ value: o.value, label: o.label, soft: riskLevelHeat(o.value).soft })));

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

  /** El nivel de una casilla: el que sirve el backend; si no llegó, el de sus riesgos (el mismo que les dio el servidor). */
  protected levelOf(l: number, i: number): string | null {
    return this.served().get(`${l}-${i}`)?.level ?? this.cells().get(`${l}-${i}`)?.risks[0]?.inherent_risk_level ?? null;
  }

  /** El valor de la casilla (probabilidad × impacto), tal como lo sirve el backend; sin matriz no se escribe. */
  protected valueOf(l: number, i: number): number | null {
    return this.served().get(`${l}-${i}`)?.value ?? null;
  }

  /** Casilla vacía: tono suave del nivel. Casilla con riesgos: tono intenso. */
  protected tone(l: number, i: number): string {
    const heat = riskLevelHeat(this.levelOf(l, i));
    return this.count(l, i) > 0 ? heat.solid : heat.soft;
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
