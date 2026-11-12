import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { DatePicker } from '@shared/presentation/components/date-picker/date-picker';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { OverviewFramework } from '@features/compliance/domain/models/overview.models';
import { OverviewService } from '@features/compliance/domain/services/overview.service';

// El período auditado de un marco del servicio y, si se quiere, su fecha de corte congelada (D87, MD-168). Sin período el motor no mide. Las fechas son días (`AAAA-MM-DD`):
// inicio y fin pueden ser el mismo día (SOC 2 Tipo I). La fecha de corte sin congelar es siempre «hoy»; congelarla no borra evidencia ni resultados. Lo mismo que el servidor
// valida (orden, dentro del período, no futura) se avisa aquí para no hacer esperar a quien se equivoca, pero manda el servidor.
@Component({
  selector: 'app-evaluation-period-form',
  imports: [TranslatePipe, FormModal, DatePicker],
  templateUrl: './evaluation-period-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvaluationPeriodForm {
  private readonly api = inject(OverviewService);
  private readonly translate = inject(TranslateService);

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

  /** Lo que ya se sabe mal sin preguntarle al servidor. */
  private readonly localErrors = computed<Record<string, string>>(() => {
    const errors: Record<string, string> = {};
    const start = this.start();
    const end = this.end();
    if (start && end && end < start) errors['period_end'] = this.translate.instant('COMPLIANCE.PERIOD.ERR_RANGE');
    return errors;
  });
  readonly errors = computed(() => ({ ...this.serverErrors(), ...this.localErrors() }));
  readonly canSave = computed(() => !!this.start() && !!this.end() && Object.keys(this.localErrors()).length === 0 && !this.sending());

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

  save(): void {
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
