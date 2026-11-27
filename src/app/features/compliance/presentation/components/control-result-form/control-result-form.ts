import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { ManagementLabelsService } from '@shared/domain/services/management-labels.service';
import { ManualTestResult } from '@features/compliance/domain/models/control.models';
import { approvalErrorKey } from '@features/compliance/domain/utils/control-approval';
import { Field } from '@shared/presentation/components/field/field';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { Busy } from '@shared/presentation/directives/busy';

// Registrar el resultado de una prueba manual del control (D140): las opciones salen del catálogo `manual_test_result_value`; la nota es obligatoria en una observación o una excepción.
@Component({
  selector: 'app-control-result-form',
  imports: [TranslatePipe, FormsModule, FormModal, Field, Select, Busy],
  templateUrl: './control-result-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlResultForm {
  private readonly api = inject(ControlService);
  private readonly translate = inject(TranslateService);
  private readonly labels = inject(ManagementLabelsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly controlId = input.required<string>();
  readonly testId = input.required<string>();
  readonly testCode = input.required<string>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly result = signal('');
  readonly note = signal('');
  readonly touched = signal(false);
  readonly sending = signal(false);
  readonly banner = signal<string | null>(null);
  protected readonly serverNote = signal<string | null>(null);

  /** El aviso solo sale si el catálogo falló; mientras carga, el select va deshabilitado sin aviso. */
  protected readonly optionsFailed = computed(() => this.labels.status('manual_test_result_value') === 'failed' && this.labels.results().length === 0);
  protected readonly optionsLoading = computed(() => this.labels.status('manual_test_result_value') === 'loading');
  protected readonly options = computed<SelectOption[]>(() => this.labels.results().map((o) => ({ value: o.value, label: o.label })));
  /** La nota es obligatoria en una observación o una excepción. */
  protected readonly noteRequired = computed(() => this.result() === 'observation' || this.result() === 'exception');
  protected readonly noteError = computed(() => (this.touched() && this.noteRequired() && this.note().trim().length === 0 ? 'COMPLIANCE.APPROVAL.RESULT.ERR_NOTE' : null));
  readonly changed = computed(() => this.result() !== '' || this.note().trim().length > 0);
  readonly canSave = computed(() => this.result() !== '');

  save(): void {
    if (this.sending() || !this.canSave()) return;
    this.touched.set(true);
    const note = this.note().trim();
    if (this.noteRequired() && !note) return;
    this.sending.set(true);
    this.banner.set(null);
    this.serverNote.set(null);
    this.api.registerResult(this.controlId(), this.testId(), { result: this.result() as ManualTestResult, ...(note ? { note } : {}) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sending.set(false);
        this.saved.emit();
      },
      error: (e: unknown) => {
        this.sending.set(false);
        const fields = apiFieldErrors(e);
        const key = approvalErrorKey(apiErrorCode(e));
        if (fields.length) this.serverNote.set(fields[0].message);
        this.banner.set(key ? this.translate.instant(key) : fields.length ? null : apiErrorMessage(e, this.translate.instant('COMPLIANCE.APPROVAL.SAVE_ERROR')));
      },
    });
  }
}
