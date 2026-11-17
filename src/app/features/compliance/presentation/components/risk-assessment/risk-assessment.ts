import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Responsible, RiskDetail, RiskEvaluationEntry } from '@shared/domain/models/risk.models';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { ResponsibleService } from '@features/compliance/domain/services/responsible.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { DetailCard } from '../detail-card/detail-card';
import { RiskLevelBadge } from '@shared/presentation/components/risk-level-badge/risk-level-badge';
import { MatrixCell, MatrixPosition, RiskMatrix } from '@shared/presentation/components/risk-matrix/risk-matrix';
import { targetValue } from '@shared/presentation/utils/event-target';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';

// La evaluación 5×5 de un riesgo y su tratamiento (MD-123). Cada evaluación y cada decisión se AGREGA (nunca pisa la anterior) y el servidor calcula el valor y el
// nivel: aquí solo se eligen probabilidad e impacto de 1 a 5. Evalúa y trata el administrador de la empresa; los demás roles leen. El historial se pide al abrirlo,
// porque no todos los roles pueden leerlo.
@Component({
  selector: 'app-risk-assessment',
  imports: [TranslatePipe, RiskLevelBadge, RiskMatrix, DetailCard, Select, Skeleton, SkeletonRegion, Busy, BusyFields],
  templateUrl: './risk-assessment.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskAssessment {
  protected readonly targetValue = targetValue;
  private readonly api = inject(RiskService);
  private readonly responsiblesApi = inject(ResponsibleService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly labels = inject(EnumLabelService);

  readonly risk = input.required<RiskDetail>();
  readonly canManage = input(false);
  // Se evaluó o se trató: el riesgo cambió y quien lo muestra lo vuelve a pedir.
  readonly changed = output<void>();

  // Las decisiones salen del backend (enum de Postgres `risk_treatment_decision`), con su texto en el idioma de la sesión.
  readonly decisions = toSignal(inject(CatalogService).options('risk_treatment_decision'), { initialValue: [] });
  /** Hoy en UTC, que es el día contra el que el backend compara la fecha límite. */
  readonly today = new Date().toISOString().slice(0, 10);

  readonly evaluated = computed(() => this.risk().inherent_risk_value !== null);
  /** Dónde cae el riesgo guardado en la matriz, con el nivel que devolvió el servidor. */
  readonly position = computed<MatrixPosition | null>(() => {
    const r = this.risk();
    return r.likelihood !== null && r.impact !== null ? { likelihood: r.likelihood, impact: r.impact, level: r.inherent_risk_level } : null;
  });
  /** La casilla elegida en el formulario, aún sin guardar. */
  readonly cell = computed<MatrixCell | null>(() => {
    const l = this.likelihood();
    const i = this.impact();
    return l !== null && i !== null ? { likelihood: l, impact: i } : null;
  });

  readonly saving = signal(false);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  // Evaluación
  readonly evaluating = signal(false);
  readonly likelihood = signal<number | null>(null);
  readonly impact = signal<number | null>(null);
  readonly history = signal<RiskEvaluationEntry[] | null>(null);
  readonly historyOpen = signal(false);
  readonly historyError = signal(false);

  // Tratamiento
  readonly treating = signal(false);
  readonly decision = signal('');
  readonly responsibleId = signal('');
  readonly dueDate = signal('');
  readonly responsibles = signal<Responsible[] | null>(null);
  readonly responsibleOptions = computed<SelectOption[]>(() =>
    (this.responsibles() ?? []).map((r) => ({ value: r.id, label: this.labels.of('COMPLIANCE.RESPONSIBLE_TYPE', r.type) + (r.person_name ? ' · ' + r.person_name : '') })),
  );

  readonly canSaveEvaluation = computed(() => this.likelihood() !== null && this.impact() !== null);
  readonly canSaveTreatment = computed(() => !!this.decision() && !!this.responsibleId() && !!this.dueDate());

  startEvaluation(): void {
    this.reset();
    this.likelihood.set(this.risk().likelihood);
    this.impact.set(this.risk().impact);
    this.evaluating.set(true);
  }

  onCell(cell: MatrixCell): void {
    this.likelihood.set(cell.likelihood);
    this.impact.set(cell.impact);
  }

  cancelEvaluation(): void {
    this.evaluating.set(false);
  }

  saveEvaluation(): void {
    if (this.saving()) return;
    const likelihood = this.likelihood();
    const impact = this.impact();
    if (likelihood === null || impact === null) return;
    this.saving.set(true);
    this.reset();
    this.api.evaluate(this.risk().id, likelihood, impact).subscribe({
      next: () => {
        this.saving.set(false);
        this.evaluating.set(false);
        this.history.set(null);
        this.historyOpen.set(false);
        this.notice.set(this.translate.instant('COMPLIANCE.RISK_ASSESSMENT.EVALUATED'));
        this.changed.emit();
      },
      error: (e) => this.fail(e),
    });
  }

  toggleHistory(): void {
    if (this.historyOpen()) {
      this.historyOpen.set(false);
      return;
    }
    this.historyOpen.set(true);
    this.historyError.set(false);
    this.api.evaluationHistory(this.risk().id).subscribe({
      next: (items) => this.history.set(items),
      error: () => this.historyError.set(true),
    });
  }

  startTreatment(): void {
    this.reset();
    const current = this.risk().treatment;
    this.decision.set(current?.decision ?? '');
    this.responsibleId.set(current?.responsible?.id ?? '');
    this.dueDate.set('');
    this.treating.set(true);
    this.responsiblesApi.list().subscribe({
      next: (list) => this.responsibles.set(list),
      error: (e) => {
        this.responsibles.set([]);
        this.fail(e);
      },
    });
  }

  cancelTreatment(): void {
    this.treating.set(false);
  }

  saveTreatment(): void {
    if (this.saving()) return;
    if (!this.canSaveTreatment()) return;
    this.saving.set(true);
    this.reset();
    this.api.createTreatment(this.risk().id, { decision: this.decision(), responsible_id: this.responsibleId(), due_date: this.dueDate() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.treating.set(false);
        this.notice.set(this.translate.instant('COMPLIANCE.RISK_ASSESSMENT.TREATED'));
        this.changed.emit();
      },
      error: (e) => this.fail(e),
    });
  }

  fullName(p: RiskEvaluationEntry['evaluated_by']): string {
    return p ? [p.name, p.last_name].filter(Boolean).join(' ') : '';
  }

  /** Una fecha con hora (UTC) en el formato del idioma. */
  dateTime(iso: string): string {
    return new Intl.DateTimeFormat(this.language.current(), { dateStyle: 'medium' }).format(new Date(iso));
  }

  /** `AAAA-MM-DD` es un día, sin hora ni zona: se muestra tal día en UTC para que no corra por la zona horaria. */
  day(value: string): string {
    return new Intl.DateTimeFormat(this.language.current(), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  }

  private fail(error: unknown): void {
    this.saving.set(false);
    // `message` ya viene traducido por el backend (422 rango y fecha, 409 riesgo dado de baja, 404 cargo inexistente).
    this.error.set(apiErrorMessage(error, this.translate.instant('COMPLIANCE.RISK_DETAIL.SAVE_ERROR')));
  }

  private reset(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
