import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Busy } from '@shared/presentation/directives/busy';
import { Field } from '@shared/presentation/components/field/field';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { Tag } from '@shared/presentation/components/tag/tag';
import { TeamMember } from '@shared/domain/models/team.models';
import { AssignmentItem } from '@features/assignment/domain/models/assignment.models';
import { DelegationScope, personName } from '@features/assignment/domain/utils/assignment-people';

const NONE = '__none__';
const SHOWN_CODES = 8;

// «Delegar» (el administrador y el responsable, D150): el ejecutor es un delegado del equipo del dueño del control, o nadie (ejecuta el dueño). Con controles de dueños distintos o sin
// dueño no hay un delegado que sirva a todos: solo se puede quitar, y el formulario dice por qué en vez de mostrar una lista vacía.
@Component({
  selector: 'app-assignment-delegate-form',
  imports: [TranslatePipe, Busy, Field, FormModal, Select, Tag],
  templateUrl: './assignment-delegate-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentDelegateForm {
  readonly controls = input.required<AssignmentItem[]>();
  readonly scope = input.required<DelegationScope>();
  /** Los delegados del equipo del dueño (ya filtrados). */
  readonly delegates = input.required<TeamMember[]>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);

  readonly submitted = output<string | null>();
  readonly closed = output<void>();

  protected readonly choice = signal('');
  protected readonly shown = computed(() => this.controls().slice(0, SHOWN_CODES));
  protected readonly hidden = computed(() => Math.max(0, this.controls().length - SHOWN_CODES));
  protected readonly removeOnly = computed(() => this.scope().kind === 'remove_only');
  protected readonly ownerName = computed(() => {
    const s = this.scope();
    return s.kind === 'team' ? s.ownerName : '';
  });
  protected readonly reasonKey = computed(() => {
    const s = this.scope();
    return s.kind === 'remove_only' ? (s.reason === 'no_owner' ? 'ASSIGNMENT.DELEGATE.REASON_NO_OWNER' : 'ASSIGNMENT.DELEGATE.REASON_MIXED_OWNERS') : null;
  });
  protected readonly options = computed<SelectOption[]>(() => [
    ...this.delegates().map((m) => ({ value: m.id, label: personName(m, m.email) })),
    { value: NONE, labelKey: 'ASSIGNMENT.DELEGATE.NONE' },
  ]);
  protected readonly canSubmit = computed(() => !this.saving() && (this.removeOnly() || this.choice() !== ''));

  protected submit(): void {
    if (!this.canSubmit()) return;
    const value = this.choice();
    this.submitted.emit(this.removeOnly() || value === NONE ? null : value);
  }
}
