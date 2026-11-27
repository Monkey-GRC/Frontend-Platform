import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Field } from '@shared/presentation/components/field/field';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { Busy } from '@shared/presentation/directives/busy';

// Un formulario de un solo texto obligatorio (un motivo o una justificación): rechazar una solicitud, pedir «No aplica» y volver a medir un requisito. Quien lo abre
// hace la llamada y le devuelve `busy` y el aviso de error del servidor.
@Component({
  selector: 'app-control-reason-form',
  imports: [TranslatePipe, FormsModule, FormModal, Field, Busy],
  templateUrl: './control-reason-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlReasonForm {
  readonly titleKey = input.required<string>();
  readonly titleParams = input<Record<string, unknown>>({});
  readonly labelKey = input.required<string>();
  readonly hintKey = input<string | null>(null);
  readonly errorKey = input.required<string>();
  readonly submitKey = input.required<string>();
  readonly busy = input(false);
  readonly banner = input<string | null>(null);
  readonly submitted = output<string>();
  readonly closed = output<void>();

  readonly text = signal('');
  readonly touched = signal(false);
  protected readonly error = computed(() => (this.touched() && this.text().trim().length === 0 ? this.errorKey() : null));
  readonly changed = computed(() => this.text().trim().length > 0);

  save(): void {
    if (this.busy()) return;
    this.touched.set(true);
    const value = this.text().trim();
    if (value) this.submitted.emit(value);
  }
}
