import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AssigneeOption } from '@features/compliance/domain/models/control.models';
import { ControlManagementService } from '@features/compliance/domain/services/control-management.service';
import { personLabel } from '@features/compliance/domain/utils/control-approval';
import { DatePicker } from '@shared/presentation/components/date-picker/date-picker';
import { Field } from '@shared/presentation/components/field/field';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { Select, SelectOption } from '@shared/presentation/components/select/select';
import { todayIso } from '@shared/domain/utils/today';
import { Busy } from '@shared/presentation/directives/busy';

export interface PlanDraft {
  what: string;
  owner_id: string;
  due_date: string;
}

// El plan de remediación de una excepción (D140): qué se hará, quién y para cuándo. Quien lo abre hace la llamada.
@Component({
  selector: 'app-control-plan-form',
  imports: [TranslatePipe, FormsModule, FormModal, Field, Select, DatePicker, Busy],
  templateUrl: './control-plan-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlPlanForm {
  private readonly api = inject(ControlManagementService);

  readonly code = input.required<string>();
  readonly busy = input(false);
  readonly banner = input<string | null>(null);
  readonly submitted = output<PlanDraft>();
  readonly closed = output<void>();

  protected readonly minDate = todayIso();
  readonly what = signal('');
  readonly assignee = signal('');
  readonly due = signal('');
  readonly touched = signal(false);
  private readonly people = signal<AssigneeOption[]>([]);

  protected readonly options = computed<SelectOption[]>(() => this.people().map((p) => ({ value: p.id, label: personLabel(p) })));
  protected readonly whatError = computed(() => (this.touched() && this.what().trim().length === 0 ? 'COMPLIANCE.APPROVAL.PLAN.ERR_WHAT' : null));
  protected readonly assigneeError = computed(() => (this.touched() && !this.assignee() ? 'COMPLIANCE.APPROVAL.PLAN.ERR_WHO' : null));
  protected readonly dueError = computed(() => (this.touched() && !this.due() ? 'COMPLIANCE.APPROVAL.PLAN.ERR_WHEN' : null));
  readonly changed = computed(() => this.what().trim().length > 0 || !!this.assignee() || !!this.due());

  readonly loadFailed = signal(false);
  private readonly destroyRef = inject(DestroyRef);
  private peopleSeq = 0;

  constructor() {
    this.loadPeople();
  }

  /** La lista de personas del directorio; si falla, se avisa y se puede reintentar. */
  loadPeople(): void {
    const seq = ++this.peopleSeq;
    this.loadFailed.set(false);
    this.api.assignees().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (p) => seq === this.peopleSeq && this.people.set(p),
      error: () => seq === this.peopleSeq && this.loadFailed.set(true),
    });
  }

  save(): void {
    if (this.busy()) return;
    this.touched.set(true);
    const what = this.what().trim();
    if (!what || !this.assignee() || !this.due()) return;
    this.submitted.emit({ what, owner_id: this.assignee(), due_date: this.due() });
  }
}
