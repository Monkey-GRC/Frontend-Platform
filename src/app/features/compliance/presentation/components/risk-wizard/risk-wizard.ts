import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { RiskDetail, RiskListItem } from '../../../domain/models/risk.models';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';
import { EnumLabelService } from '../../../domain/services/enum-label.service';
import { RiskService } from '../../../domain/services/risk.service';
import { firstPendingIndex, nextPendingIndex, riskProgress } from '../../../domain/utils/risk-progress';
import { RiskLevelBadge } from '../risk-level-badge/risk-level-badge';

type Stage = 'loading' | 'error' | 'ready' | 'done';

/** Los cinco niveles de cada escala (contrato `compliance-risks.md`: probabilidad e impacto van de 1 a 5). Los textos de cada nivel están en las traducciones. */
export const SCALE_LEVELS = [1, 2, 3, 4, 5] as const;

const byCode = (a: RiskListItem, b: RiskListItem) => a.code.localeCompare(b.code, 'es', { numeric: true });

// D89 · El paso entre declarar un servicio y declarar sus activos. La persona evalúa los riesgos de su servicio uno a uno, con dos preguntas de 1 a 5 —qué tan probable
// es que ocurra y qué tan grave sería— en lenguaje claro y con las escalas del comité (hoja «Riesgos»). El servidor calcula el valor y el nivel. Se puede retomar donde se dejó:
// empieza por el primer riesgo sin evaluar. Al terminar avisa (`finished`) y quien lo muestra decide a dónde sigue: la pantalla de crear servicio y el detalle del servicio lo usan.
// La pestaña Riesgos de Cumplimiento queda para ver y corregir esas calificaciones después.
@Component({
  selector: 'app-risk-wizard',
  imports: [TranslatePipe, LoadingSpinner, RiskLevelBadge],
  templateUrl: './risk-wizard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskWizard {
  private readonly api = inject(RiskService);
  private readonly translate = inject(TranslateService);
  readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  readonly serviceId = input.required<string>();
  /** Lo que dice el botón final: «Declarar los activos» en el alta del servicio, «Seguir» cuando se retoma desde el detalle. */
  readonly finishKey = input('COMPLIANCE.RISK_WIZARD.FINISH');
  /** Terminó el último riesgo y la persona pulsó el botón de cierre. */
  readonly finished = output<void>();

  readonly levels = SCALE_LEVELS;

  readonly stage = signal<Stage>('loading');
  readonly risks = signal<RiskListItem[]>([]);
  readonly index = signal(0);
  /** El detalle del riesgo que se está evaluando (su descripción y qué podría perderse); se pide al llegar a él. */
  readonly detail = signal<RiskDetail | null>(null);
  readonly likelihood = signal<number | null>(null);
  readonly impact = signal<number | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly current = computed(() => this.risks()[this.index()] ?? null);
  readonly progress = computed(() => riskProgress(this.risks()));
  readonly canSave = computed(() => this.likelihood() !== null && this.impact() !== null && !this.saving());
  /** ¿Guardar este es lo último que falta? Cambia el texto del botón. */
  readonly closesTheStep = computed(() => {
    const c = this.current();
    return !!c && this.progress().pending === (this.isEvaluated(c) ? 0 : 1);
  });

  private readonly details = new Map<string, RiskDetail>();

  constructor() {
    effect(() => {
      this.serviceId();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.stage.set('loading');
    this.api.listAllRisks(this.serviceId()).subscribe({
      next: (list) => {
        const active = list.filter((r) => r.is_active).sort(byCode);
        this.risks.set(active);
        const start = firstPendingIndex(active);
        // Sin riesgos vigentes, o con todos ya evaluados, no hay nada que preguntar: se pasa al cierre.
        if (start === null) {
          this.stage.set('done');
          return;
        }
        this.go(start);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  isEvaluated(r: RiskListItem): boolean {
    return r.likelihood !== null && r.impact !== null;
  }

  pick(question: 'likelihood' | 'impact', level: number): void {
    (question === 'likelihood' ? this.likelihood : this.impact).set(level);
  }

  save(): void {
    const risk = this.current();
    const likelihood = this.likelihood();
    const impact = this.impact();
    if (!risk || likelihood === null || impact === null) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.evaluate(risk.id, likelihood, impact).subscribe({
      next: (score) => {
        this.saving.set(false);
        // El servidor calculó el valor y el nivel: se guardan tal cual en la lista.
        this.risks.update((list) =>
          list.map((r) => (r.id === risk.id ? { ...r, likelihood: score.likelihood, impact: score.impact, inherent_risk_value: score.inherent_risk_value, inherent_risk_level: score.inherent_risk_level } : r)),
        );
        const next = nextPendingIndex(this.risks(), this.index());
        if (next === null) {
          this.stage.set('done');
          return;
        }
        this.go(next);
      },
      error: (e) => {
        this.saving.set(false);
        // `message` ya viene traducido por el backend (422 rango, 409 riesgo dado de baja, 403 si no es el administrador).
        this.error.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.RISK_WIZARD.SAVE_ERROR')));
      },
    });
  }

  back(): void {
    if (this.index() > 0) this.go(this.index() - 1);
  }

  /** Vuelve del cierre al último riesgo para corregirlo. */
  review(): void {
    this.stage.set('ready');
    this.go(this.risks().length - 1);
  }

  finish(): void {
    this.finished.emit();
  }

  private go(index: number): void {
    this.index.set(index);
    this.error.set(null);
    const risk = this.risks()[index];
    // Si ya estaba evaluado, se muestra lo que se respondió; si no, las preguntas empiezan sin respuesta (nunca hay una elegida por defecto).
    this.likelihood.set(risk?.likelihood ?? null);
    this.impact.set(risk?.impact ?? null);
    this.detail.set(null);
    if (!risk) return;
    const cached = this.details.get(risk.id);
    if (cached) {
      this.detail.set(cached);
      return;
    }
    this.api.getRisk(risk.id).subscribe({
      next: (d) => {
        this.details.set(risk.id, d);
        if (this.current()?.id === risk.id) this.detail.set(d);
      },
      // La descripción ayuda pero no es indispensable: sin ella se sigue evaluando.
      error: () => undefined,
    });
  }
}
