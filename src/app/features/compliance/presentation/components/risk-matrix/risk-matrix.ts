import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { riskLevelLook } from '../risk-level-badge/risk-level-badge';

export interface MatrixCell {
  likelihood: number;
  impact: number;
}

/** Dónde cae un riesgo ya evaluado y con qué nivel, tal como lo devolvió el servidor. */
export interface MatrixPosition extends MatrixCell {
  level: string | null;
}

// La matriz 5×5 de un riesgo: probabilidad (de abajo hacia arriba) por impacto (de izquierda a derecha). Sirve para ELEGIR una casilla al evaluar y para VER dónde
// cae un riesgo ya evaluado. El nivel (Bajo, Moderado, Alto, Crítico) lo calcula el servidor al guardar (compliance-risks.md): la matriz no lo recalcula, por eso
// las casillas son neutras y solo la del riesgo guardado se pinta con el nivel que el servidor devolvió.
// Teclado: es un solo punto de tabulación; las flechas mueven entre casillas y Enter o Espacio eligen.
@Component({
  selector: 'app-risk-matrix',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './risk-matrix.html',
})
export class RiskMatrix {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly translate = inject(TranslateService);

  /** La casilla elegida en el formulario (aún sin guardar). */
  readonly selected = input<MatrixCell | null>(null);
  /** El riesgo tal como está guardado: su casilla se pinta con el nivel del servidor. */
  readonly saved = input<MatrixPosition | null>(null);
  readonly editable = input(false);
  readonly disabled = input(false);

  readonly picked = output<MatrixCell>();

  // La escala (hoy 1 a 5) la sirve el backend (`risk_scale`): el mismo rango que acepta la evaluación de un riesgo.
  private readonly scale = computed(() => this.scaleOptions().map((o) => Number(o.value)).sort((a, b) => a - b));
  private readonly scaleOptions = toSignal(inject(CatalogService).options('risk_scale'), { initialValue: [] });
  /** Probabilidad de arriba (la más alta) a abajo (1): lo más probable arriba, como se lee una matriz de riesgo. */
  readonly likelihoods = computed(() => [...this.scale()].reverse());
  readonly impacts = this.scale;
  /** Una columna para el número del eje y una por cada valor de la escala. */
  protected readonly columns = computed(() => `1.25rem repeat(${this.scale().length}, 2.5rem)`);

  // La casilla que recibe el foco con Tab: la elegida, o la del riesgo guardado, o la del medio.
  private readonly focused = signal<MatrixCell | null>(null);
  protected readonly stop = computed<MatrixCell>(() => this.focused() ?? this.selected() ?? this.saved() ?? this.middle());

  /** El valor del medio de la escala: por dónde se entra con Tab cuando nada está elegido. */
  private middle(): MatrixCell {
    const mid = this.scale()[Math.floor(this.scale().length / 2)] ?? 1;
    return { likelihood: mid, impact: mid };
  }

  protected isSelected(l: number, i: number): boolean {
    const s = this.selected();
    return !!s && s.likelihood === l && s.impact === i;
  }

  protected isSaved(l: number, i: number): boolean {
    const s = this.saved();
    return !!s && s.likelihood === l && s.impact === i;
  }

  protected savedChip(): string {
    return riskLevelLook(this.saved()?.level).chip;
  }

  protected isStop(l: number, i: number): boolean {
    const s = this.stop();
    return s.likelihood === l && s.impact === i;
  }

  protected label(l: number, i: number): string {
    return this.translate.instant('COMPLIANCE.RISK_ASSESSMENT.CELL_ARIA', { likelihood: l, impact: i });
  }

  protected pick(l: number, i: number): void {
    if (this.disabled()) return;
    this.focused.set({ likelihood: l, impact: i });
    this.picked.emit({ likelihood: l, impact: i });
  }

  protected move(event: KeyboardEvent, l: number, i: number): void {
    const delta: Record<string, [number, number]> = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] };
    const step = delta[event.key];
    if (!step) return;
    event.preventDefault();
    const [min, max] = [Math.min(...this.scale()), Math.max(...this.scale())];
    const next = { likelihood: Math.min(max, Math.max(min, l + step[0])), impact: Math.min(max, Math.max(min, i + step[1])) };
    this.focused.set(next);
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-cell="${next.likelihood}-${next.impact}"]`)?.focus());
  }
}
