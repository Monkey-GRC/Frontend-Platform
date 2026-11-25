import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { DatePicker } from '@shared/presentation/components/date-picker/date-picker';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { OverviewFramework } from '@features/compliance/domain/models/overview.models';
import { OverviewService } from '@features/compliance/domain/services/overview.service';
import { Busy } from '@shared/presentation/directives/busy';
import { LanguageService } from '@core/domain/services/language.service';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { earliestPeriodEnd, periodProblem } from '@features/compliance/domain/utils/evaluation-period';

// El período auditado de un marco del servicio (D87, MD-168, D145). Sin período el motor no mide y el marco queda «Sin medir». Las fechas son días (`AAAA-MM-DD`). Solo Tipo II:
// el fin es posterior al inicio y, en SOC 2, el período dura como mínimo 6 meses; al terminar, el siguiente se abre solo y este queda en el histórico. Lo que el servidor valida
// (`period.invalid_range`, `period.too_short`) se avisa aquí para no hacer esperar a quien se equivoca, pero manda el servidor.
@Component({
  selector: 'app-evaluation-period-form',
  imports: [TranslatePipe, FormModal, DatePicker, Busy],
  templateUrl: './evaluation-period-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvaluationPeriodForm {
  private readonly api = inject(OverviewService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly serviceId = input.required<string>();
  readonly framework = input.required<OverviewFramework>();
  /** Se guardó: quien lo muestra vuelve a pedir el resumen. */
  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly start = signal('');
  readonly end = signal('');

  readonly sending = signal(false);
  readonly banner = signal<string | null>(null);
  private readonly serverErrors = signal<Record<string, string>>({});

  /** Los meses mínimos del marco (SOC 2: 6) o `null`: la explicación del formulario los nombra. */
  readonly minMonths = computed(() => this.framework().evaluation.min_period_months ?? null);

  /** Lo que ya se sabe mal sin preguntarle al servidor. */
  private readonly localErrors = computed<Record<string, string>>(() => {
    const errors: Record<string, string> = {};
    const problem = periodProblem(this.minMonths(), this.start(), this.end());
    if (problem === 'range') errors['period_end'] = this.translate.instant('COMPLIANCE.PERIOD.ERR_RANGE');
    if (problem === 'too_short') {
      const months = this.minMonths() ?? 0;
      errors['period_end'] = this.translate.instant('COMPLIANCE.PERIOD.ERR_TOO_SHORT', { months, date: this.day(earliestPeriodEnd(this.start(), months)) });
    }
    return errors;
  });
  readonly errors = computed(() => ({ ...this.serverErrors(), ...this.localErrors() }));
  /** MD-485 · Las fechas ya no son las que tenía el marco: cerrar pide confirmar antes de descartarlas. */
  readonly changed = computed(() => {
    const e = this.framework().evaluation;
    return (this.start() || '') !== (e.period_start ?? '') || (this.end() || '') !== (e.period_end ?? '');
  });
  readonly canSave = computed(() => !!this.start() && !!this.end() && Object.keys(this.localErrors()).length === 0);

  constructor() {
    // Se abre con lo que el marco ya tiene; sin período, vacío, y la fecha de corte congelada propone hoy.
    effect(() => {
      const e = this.framework().evaluation;
      untracked(() => {
        this.start.set(e.period_start ?? '');
        this.end.set(e.period_end ?? '');
      });
    });
  }

  private day(value: string): string {
    return formatLocalDate(value, this.language.current(), { calendar: true, style: 'long' });
  }

  save(): void {
    if (this.sending()) return;
    if (!this.canSave()) return;
    this.sending.set(true);
    this.banner.set(null);
    this.serverErrors.set({});
    this.api
      .setEvaluationPeriod(this.serviceId(), this.framework().framework_code, {
        period_start: this.start(),
        period_end: this.end(),
        // D105 · La fecha de corte ya no se elige: es siempre hoy (la última revisión automática). Mandar null también descongela una que hubiera quedado de antes.
        cutoff_date: null,
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.saved.emit();
        },
        // `message` y el de cada campo ya vienen traducidos por el backend (422 fechas, 404 marco no contratado, 403 rol).
        error: (e: unknown) => {
          this.sending.set(false);
          const fields = apiFieldErrors(e);
          if (fields.length) this.serverErrors.set(Object.fromEntries(fields.map((f) => [f.field, f.message])));
          else this.banner.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.PERIOD.SAVE_ERROR')));
        },
      });
  }
}
