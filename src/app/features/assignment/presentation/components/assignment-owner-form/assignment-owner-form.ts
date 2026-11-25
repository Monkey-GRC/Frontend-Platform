import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Busy } from '@shared/presentation/directives/busy';
import { Field } from '@shared/presentation/components/field/field';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { Tag } from '@shared/presentation/components/tag/tag';
import { TeamMember } from '@shared/domain/models/team.models';
import { AssignmentItem } from '@features/assignment/domain/models/assignment.models';
import { personName } from '@features/assignment/domain/utils/assignment-people';

const NONE = '__none__';
const SHOWN_CODES = 8;

// «Asignar dueño» (solo el administrador, D150): un responsable o el propio administrador, o dejar los controles sin dueño. Cambiar el dueño limpia el ejecutor, y el formulario lo dice
// antes de enviar. El envío y el error son de quien lo abre (la vista llama al servicio); aquí solo se elige.
@Component({
  selector: 'app-assignment-owner-form',
  imports: [TranslatePipe, Busy, Field, FormModal, Select, Tag],
  templateUrl: './assignment-owner-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentOwnerForm {
  readonly controls = input.required<AssignmentItem[]>();
  readonly candidates = input.required<TeamMember[]>();
  readonly meId = input<string | null>(null);
  readonly saving = input(false);
  /** El mensaje ya traducido del último intento fallido. */
  readonly error = input<string | null>(null);

  readonly submitted = output<string | null>();
  readonly closed = output<void>();

  protected readonly choice = signal('');
  protected readonly shown = computed(() => this.controls().slice(0, SHOWN_CODES));
  protected readonly hidden = computed(() => Math.max(0, this.controls().length - SHOWN_CODES));
  protected readonly options = computed<SelectOption[]>(() => [
    ...this.candidates().map((m) => ({
      value: m.id,
      label: personName(m, m.email),
      labelKey: m.id === this.meId() ? 'ASSIGNMENT.OWNER.ME' : undefined,
      labelParams: { name: personName(m, m.email) },
    })),
    { value: NONE, labelKey: 'ASSIGNMENT.OWNER.NONE' },
  ]);
  protected readonly canSubmit = computed(() => this.choice() !== '' && !this.saving());

  protected submit(): void {
    const value = this.choice();
    if (!this.canSubmit()) return;
    this.submitted.emit(value === NONE ? null : value);
  }
}
