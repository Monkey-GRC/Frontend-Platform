import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DatePicker } from '@shared/presentation/components/date-picker/date-picker';
import { Field } from '@shared/presentation/components/field/field';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { todayIso } from '@shared/domain/utils/today';
import { Busy } from '@shared/presentation/directives/busy';

// Un caso de un requisito «cuando ocurra» (DT-115): la fecha fija el trimestre; la descripción dice qué pasó, en una línea.
@Component({
  selector: 'app-control-occurrence-form',
  imports: [TranslatePipe, FormsModule, FormModal, Field, DatePicker, Busy],
  templateUrl: './control-occurrence-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlOccurrenceForm {
  readonly code = input.required<string>();
  readonly busy = input(false);
  readonly banner = input<string | null>(null);
  readonly submitted = output<{ occurred_on: string; description: string }>();
  readonly closed = output<void>();

  protected readonly maxDate = todayIso();
  readonly date = signal('');
  readonly description = signal('');
  readonly touched = signal(false);
  protected readonly dateError = computed(() => (this.touched() && !this.date() ? 'COMPLIANCE.APPROVAL.OCCURRENCE.ERR_DATE' : null));
  protected readonly descriptionError = computed(() => (this.touched() && this.description().trim().length === 0 ? 'COMPLIANCE.APPROVAL.OCCURRENCE.ERR_DESCRIPTION' : null));
  readonly changed = computed(() => !!this.date() || this.description().trim().length > 0);

  save(): void {
    if (this.busy()) return;
    this.touched.set(true);
    const description = this.description().trim();
    if (!this.date() || !description) return;
    this.submitted.emit({ occurred_on: this.date(), description });
  }
}
