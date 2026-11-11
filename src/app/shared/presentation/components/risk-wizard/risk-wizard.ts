import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { Modal } from '@shared/presentation/components/modal/modal';
import { Tag } from '@shared/presentation/components/tag/tag';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { RiskDetail, RiskListItem, RiskMatrixData } from '@shared/domain/models/risk.models';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { firstPendingIndex, nextPendingIndex, riskProgress } from '@shared/domain/utils/risk-progress';
import { RiskCausesPicker } from '../risk-causes-picker/risk-causes-picker';
import { RiskForm } from '../risk-form/risk-form';
import { RiskLevelBadge, riskLevelHeat } from '../risk-level-badge/risk-level-badge';
import { MatrixPosition, RiskMatrix } from '../risk-matrix/risk-matrix';
import { targetValue } from '@shared/presentation/utils/event-target';

type Stage = 'loading' | 'error' | 'ready' | 'done' | 'causes';

/** Los cinco niveles de cada escala (contrato `compliance-risks.md`: probabilidad e impacto van de 1 a 5). Los textos de cada nivel están en las traducciones. */
export const SCALE_LEVELS = [1, 2, 3, 4, 5] as const;

/** Lo mínimo que se le pide a quien retira un riesgo: unas palabras que expliquen por qué no aplica (D93). El servidor admite hasta 500. */
export const REASON_MIN = 3;
export const REASON_MAX = 500;

// Las dos escalas (probabilidad e impacto, de 1 a 5) no son un estado: el color de una opción no dice nada, así que todas se ven igual y solo la elegida se destaca con el
// color de acción. El número y el nombre van siempre en la tarjeta. `badge` es el círculo con el número; `idle` la tarjeta sin elegir; `selected` la elegida.
const SCALE_TONE = {
  badge: 'bg-tint-strong text-tint-ink',
  idle: 'border-line bg-surface hover:border-action/50 hover:bg-tint',
  selected: 'border-action bg-tint ring-2 ring-action',
};

const byCode = (a: RiskListItem, b: RiskListItem) => a.code.localeCompare(b.code, 'es', { numeric: true });

// D89 · El paso entre declarar un servicio y declarar sus activos. La persona evalúa los riesgos de su servicio uno a uno, con dos preguntas de 1 a 5 —qué tan probable
// es que ocurra y qué tan grave sería— en lenguaje claro y con las escalas del comité (hoja «Riesgos»). El servidor calcula el valor y el nivel. Se puede retomar donde se dejó:
// empieza por el primer riesgo sin evaluar. Al terminar avisa (`finished`) y quien lo muestra decide a dónde sigue: la pantalla de crear servicio y el detalle del servicio lo usan.
// D93 · Un riesgo que no aplica al servicio se retira aquí mismo, con un motivo (y se puede volver a incluir); no cuenta como pendiente y no retira sus causas ni sus controles.
// También se puede agregar un riesgo propio y elegir sus causas. La pestaña Riesgos de Cumplimiento queda para ver y corregir esas calificaciones después.
@Component({
  selector: 'app-risk-wizard',
  imports: [NgTemplateOutlet, TranslatePipe, LoadingSpinner, Modal, Tag, RiskLevelBadge, RiskMatrix, RiskForm, RiskCausesPicker],
  templateUrl: './risk-wizard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskWizard {
  protected readonly targetValue = targetValue;
  private readonly api = inject(RiskService);
  private readonly translate = inject(TranslateService);
  readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  readonly serviceId = input.required<string>();
  /** Lo que dice el botón final: «Declarar los activos» en el alta del servicio, «Seguir» cuando se retoma desde el detalle. */
  /** Terminó el último riesgo y la persona pulsó el botón de cierre. */
  readonly finished = output<void>();

  readonly levels = SCALE_LEVELS;
  readonly reasonMax = REASON_MAX;

  readonly stage = signal<Stage>('loading');
  /** Los riesgos vigentes del servicio: los que se evalúan. */
  readonly risks = signal<RiskListItem[]>([]);
  /** Los retirados, por si se quiere volver a incluir alguno. */
  readonly removed = signal<RiskListItem[]>([]);
  readonly index = signal(0);
  /** El detalle del riesgo que se está evaluando (su descripción y qué podría perderse); se pide al llegar a él. */
  readonly detail = signal<RiskDetail | null>(null);
  readonly likelihood = signal<number | null>(null);
  readonly impact = signal<number | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  // D93 · Retirar el riesgo que no aplica.
  readonly removing = signal(false);
  readonly reason = signal('');
  readonly removingBusy = signal(false);
  readonly removeError = signal<string | null>(null);
  /** Cuántos se retiraron en esta sesión: se dice al terminar. */
  readonly removedCount = signal(0);
  readonly reasonValid = computed(() => this.reason().trim().length >= REASON_MIN);
  readonly restoring = signal<string | null>(null);
  readonly restoreError = signal<string | null>(null);

  // D93 · Agregar un riesgo propio y elegir sus causas.
  readonly adding = signal(false);
  readonly causesFor = signal<{ id: string; name: string } | null>(null);

  readonly current = computed(() => this.risks()[this.index()] ?? null);
  readonly progress = computed(() => riskProgress(this.risks()));
  readonly canSave = computed(() => this.likelihood() !== null && this.impact() !== null && !this.saving());
  /** ¿Guardar este es lo último que falta? Cambia el texto del botón. */
  readonly closesTheStep = computed(() => {
    const c = this.current();
    return !!c && this.progress().pending === (this.isEvaluated(c) ? 0 : 1);
  });

  // El nivel de cada casilla lo sirve el backend (`GET /risk-matrix`): con él se muestra, antes de guardar, en qué nivel quedaría el riesgo con lo que se eligió.
  private readonly matrix = toSignal(this.api.matrix().pipe(catchError(() => of(null as RiskMatrixData | null))), { initialValue: null as RiskMatrixData | null });
  /** Dónde cae lo que se eligió y con qué nivel; `null` mientras falte una de las dos respuestas. */
  readonly preview = computed<(MatrixPosition & { value: number }) | null>(() => {
    const likelihood = this.likelihood();
    const impact = this.impact();
    if (likelihood === null || impact === null) return null;
    const cell = this.matrix()?.cells.find((c) => c.likelihood === likelihood && c.impact === impact);
    return { likelihood, impact, value: cell?.value ?? likelihood * impact, level: cell?.level ?? null };
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
    this.fetch(null);
  }

  /** Vuelve a pedir los riesgos (vigentes y retirados) y se queda en `focusId`, o en el primero pendiente. */
  private fetch(focusId: string | null, after?: () => void): void {
    this.api.listAllRisks(this.serviceId(), undefined, true).subscribe({
      next: (list) => {
        const active = list.filter((r) => r.is_active).sort(byCode);
        this.risks.set(active);
        this.removed.set(list.filter((r) => !r.is_active).sort(byCode));
        after?.();
        const focus = focusId ? active.findIndex((r) => r.id === focusId) : -1;
        const start = focus >= 0 ? focus : firstPendingIndex(active);
        // Sin riesgos vigentes, o con todos ya evaluados, no hay nada que preguntar: se pasa al cierre.
        if (start === null) {
          this.stage.set('done');
          return;
        }
        this.go(start);
        // Un riesgo recién agregado pasa primero por la elección de sus causas.
        this.stage.set(this.causesFor() ? 'causes' : 'ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  isEvaluated(r: RiskListItem): boolean {
    return r.likelihood !== null && r.impact !== null;
  }

  scaleTone(level: number, selected: boolean): string {
    return selected ? SCALE_TONE.selected : SCALE_TONE.idle;
  }

  scaleBadge(): string {
    return SCALE_TONE.badge;
  }

  /** El color de la pastilla de un riesgo en la lista: su nivel si ya se evaluó, neutro si no. */
  chipTone(r: RiskListItem): string {
    return this.isEvaluated(r) ? riskLevelHeat(r.inherent_risk_level).solid : 'border-line bg-surface text-ink-muted';
  }

  pick(question: 'likelihood' | 'impact', level: number): void {
    (question === 'likelihood' ? this.likelihood : this.impact).set(level);
  }

  jump(index: number): void {
    if (this.saving() || this.removingBusy()) return;
    if (this.stage() !== 'ready') this.stage.set('ready');
    this.go(index);
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

  askRemove(): void {
    this.reason.set('');
    this.removeError.set(null);
    this.removing.set(true);
  }

  cancelRemove(): void {
    this.removing.set(false);
    this.removeError.set(null);
  }

  setReason(value: string): void {
    this.reason.set(value.slice(0, REASON_MAX));
  }

  /** D93 · El riesgo no aplica al servicio: se da de baja con su motivo. Sus causas y controles no se tocan; ya no cuenta como pendiente. */
  confirmRemove(): void {
    const risk = this.current();
    if (!risk || !this.reasonValid() || this.removingBusy()) return;
    this.removingBusy.set(true);
    this.removeError.set(null);
    this.api.deactivateRisk(risk.id, this.reason().trim()).subscribe({
      next: () => {
        this.removingBusy.set(false);
        this.removedCount.update((n) => n + 1);
        const at = this.index();
        const rest = this.risks().filter((r) => r.id !== risk.id);
        this.risks.set(rest);
        this.removed.update((list) => [...list, { ...risk, is_active: false }].sort(byCode));
        this.details.delete(risk.id);
        const next = rest.length === 0 ? null : nextPendingIndex(rest, at - 1);
        if (next === null) {
          this.removing.set(false);
          this.stage.set('done');
          return;
        }
        this.go(next);
      },
      error: (e) => {
        this.removingBusy.set(false);
        this.removeError.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.RISK_WIZARD.REMOVE_ERROR')));
      },
    });
  }

  /** D93 · Vuelve a incluir un riesgo retirado: queda vigente, con su evaluación anterior si la tenía, y el asistente lo muestra. */
  restore(risk: RiskListItem): void {
    if (this.restoring()) return;
    this.restoring.set(risk.id);
    this.restoreError.set(null);
    this.api.reactivateRisk(risk.id).subscribe({
      next: () => {
        this.restoring.set(null);
        this.removedCount.update((n) => Math.max(0, n - 1));
        this.fetch(risk.id);
      },
      error: (e) => {
        this.restoring.set(null);
        this.restoreError.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.RISK_WIZARD.RESTORE_ERROR')));
      },
    });
  }

  /** D93 · Se guardó un riesgo propio nuevo: se recarga la lista y se pasa a elegir sus causas. */
  onRiskCreated(id: string): void {
    this.adding.set(false);
    this.stage.set('loading');
    this.fetch(id, () => {
      const created = this.risks().find((r) => r.id === id);
      if (created) this.causesFor.set({ id, name: created.name });
    });
  }

  /** Terminó de elegir las causas: se califica el riesgo nuevo (queda pendiente, como cualquier otro). */
  finishCauses(): void {
    const target = this.causesFor();
    this.causesFor.set(null);
    this.details.delete(target?.id ?? '');
    const at = this.risks().findIndex((r) => r.id === target?.id);
    this.stage.set('ready');
    this.go(at >= 0 ? at : 0);
  }

  back(): void {
    if (this.index() > 0) this.go(this.index() - 1);
  }

  /** Vuelve del cierre al último riesgo para corregirlo. */
  review(): void {
    if (this.risks().length === 0) return;
    this.stage.set('ready');
    this.go(this.risks().length - 1);
  }

  finish(): void {
    this.finished.emit();
  }

  private go(index: number): void {
    this.index.set(index);
    this.error.set(null);
    this.removing.set(false);
    this.removeError.set(null);
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
