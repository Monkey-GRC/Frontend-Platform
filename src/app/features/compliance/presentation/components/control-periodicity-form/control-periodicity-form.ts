import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { ControlDetail, Periodicity } from '@features/compliance/domain/models/control.models';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { periodicityText, summarizePeriodicity } from '@features/compliance/domain/utils/control-v2-look';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { Field } from '@shared/presentation/components/field/field';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { Busy } from '@shared/presentation/directives/busy';

const JUSTIFICATION_MAX = 1000;

// Cambiar la periodicidad de un control del catálogo (G-10, D147): la elige el administrador de la empresa, con justificación, y se aplica a todos los requisitos del control.
// La opción vacía es «Usar la sugerida» (`periodicity: null`). Los 422 salen bajo su campo y el 409 (control dado de baja) en un aviso; manda el servidor.
@Component({
  selector: 'app-control-periodicity-form',
  imports: [TranslatePipe, FormsModule, FormModal, Field, Select, Busy],
  templateUrl: './control-periodicity-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlPeriodicityForm {
  private readonly api = inject(ControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly translate = inject(TranslateService);
  private readonly view = inject(ComplianceViewService);
  protected readonly labels = inject(EnumLabelService);

  readonly detail = input.required<ControlDetail>();
  /** Se guardó: trae el detalle ya recalculado. */
  readonly saved = output<ControlDetail>();
  readonly closed = output<void>();

  private readonly options = signal<CatalogOption[]>([]);
  private readonly summary = computed(() => summarizePeriodicity(this.detail().technical?.requirements ?? []));
  protected readonly text = computed(() => periodicityText(this.summary(), this.labels));
  protected readonly selectOptions = computed<SelectOption[]>(() => this.options().map((o) => ({ value: o.value, label: o.label })));

  /** Si ya la cambió la organización se abre con esa; si no, con «Usar la sugerida». */
  private readonly initial = computed(() => {
    const s = this.summary();
    return s.adjusted && s.current.length === 1 ? s.current[0] : '';
  });
  readonly periodicity = signal<string | null>(null);
  readonly justification = signal('');
  readonly sending = signal(false);
  readonly banner = signal<string | null>(null);
  private readonly serverErrors = signal<Record<string, string>>({});

  protected readonly chosen = computed(() => this.periodicity() ?? this.initial());
  private readonly justificationLength = computed(() => this.justification().trim().length);
  readonly errors = computed<Record<string, string>>(() => {
    const errors: Record<string, string> = {};
    if (this.justificationLength() > JUSTIFICATION_MAX) errors['justification'] = this.translate.instant('COMPLIANCE.PERIODICITY_CHANGE.ERR_MAX', { max: JUSTIFICATION_MAX });
    return { ...this.serverErrors(), ...errors };
  });
  readonly changed = computed(() => this.chosen() !== this.initial() || this.justificationLength() > 0);
  readonly canSave = computed(() => this.chosen() !== this.initial() && this.justificationLength() > 0 && this.justificationLength() <= JUSTIFICATION_MAX);

  constructor() {
    this.catalogs.options('periodicity').pipe(takeUntilDestroyed()).subscribe((o) => this.options.set(o));
  }

  pick(value: string): void {
    this.periodicity.set(value);
    this.serverErrors.update(({ periodicity: _, ...rest }) => rest);
  }

  save(): void {
    if (this.sending() || !this.canSave()) return;
    this.sending.set(true);
    this.banner.set(null);
    this.serverErrors.set({});
    const value = this.chosen();
    this.api.setPeriodicity(this.detail().id, { periodicity: value === '' ? null : (value as Periodicity), justification: this.justification().trim() }, this.view.viewParam()).subscribe({
      next: (detail) => {
        this.sending.set(false);
        this.saved.emit(detail);
      },
      error: (e: unknown) => {
        this.sending.set(false);
        const fields = apiFieldErrors(e);
        if (fields.length) this.serverErrors.set(Object.fromEntries(fields.map((f) => [f.field, f.message])));
        // 409 CONTROL_RETIRED y el resto: el mensaje ya viene traducido por el backend.
        else this.banner.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.PERIODICITY_CHANGE.SAVE_ERROR')));
      },
    });
  }
}
