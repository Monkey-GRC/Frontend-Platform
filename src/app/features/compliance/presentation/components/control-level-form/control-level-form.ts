import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ControlLevel } from '@features/compliance/domain/models/control.models';
import { ManagementLabelsService } from '@shared/domain/services/management-labels.service';
import { Field } from '@shared/presentation/components/field/field';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { Busy } from '@shared/presentation/directives/busy';

// Cambiar el nivel final de un control (R5, D140): las opciones son las que el servidor dejó (`allowed_levels`) y la justificación es obligatoria. El administrador la verá al aprobar.
@Component({
  selector: 'app-control-level-form',
  imports: [TranslatePipe, FormsModule, FormModal, Field, Select, Busy],
  templateUrl: './control-level-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlLevelForm {
  private readonly labels = inject(ManagementLabelsService);

  readonly code = input.required<string>();
  readonly allowed = input.required<ControlLevel[]>();
  /** Si el administrador lleva el control, el cambio nace aprobado: el botón dice «Guardar». */
  readonly direct = input(false);
  readonly busy = input(false);
  readonly banner = input<string | null>(null);
  readonly submitted = output<{ proposed_level: ControlLevel; justification: string }>();
  readonly closed = output<void>();

  readonly level = signal('');
  readonly justification = signal('');
  readonly touched = signal(false);

  protected readonly options = computed<SelectOption[]>(() => this.allowed().map((value) => ({ value, label: this.labels.label('control_level', value) })));
  protected readonly justificationError = computed(() => (this.touched() && this.justification().trim().length === 0 ? 'COMPLIANCE.APPROVAL.LEVEL.ERR_JUSTIFICATION' : null));
  readonly changed = computed(() => this.level() !== '' || this.justification().trim().length > 0);
  readonly canSave = computed(() => this.level() !== '');

  save(): void {
    if (this.busy() || !this.canSave()) return;
    this.touched.set(true);
    const justification = this.justification().trim();
    if (justification) this.submitted.emit({ proposed_level: this.level() as ControlLevel, justification });
  }
}
