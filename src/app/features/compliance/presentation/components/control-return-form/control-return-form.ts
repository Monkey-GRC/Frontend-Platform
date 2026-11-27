import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { ControlDetail } from '@features/compliance/domain/models/control.models';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { approvalErrorKey, isStaleConflict } from '@features/compliance/domain/utils/control-approval';
import { Field } from '@shared/presentation/components/field/field';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { Busy } from '@shared/presentation/directives/busy';

// Devolver un control (aprobacion.md): el motivo es obligatorio y, si se quiere, las entregas de evidencia que hay que rehacer. Quien carga la evidencia verá el motivo.
@Component({
  selector: 'app-control-return-form',
  imports: [TranslatePipe, FormsModule, FormModal, Field, Busy],
  templateUrl: './control-return-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlReturnForm {
  private readonly api = inject(ControlService);
  private readonly translate = inject(TranslateService);
  private readonly view = inject(ComplianceViewService);
  private readonly destroyRef = inject(DestroyRef);

  readonly detail = input.required<ControlDetail>();
  /** Se devolvió: el control cambió y la vista se vuelve a pedir. */
  readonly returned = output<void>();
  /** El control ya cambió por otro lado (409): se vuelve a pedir, y el formulario se queda con su aviso. */
  readonly stale = output<void>();
  readonly closed = output<void>();

  readonly reason = signal('');
  readonly picked = signal<readonly string[]>([]);
  readonly touched = signal(false);
  readonly sending = signal(false);
  readonly banner = signal<string | null>(null);
  protected readonly serverReason = signal<string | null>(null);

  /** Las entregas del control (la última de cada requisito de evidencia manual), por si alguna es la causa de la devolución. */
  protected readonly submissions = computed(() =>
    this.detail().evidence.flatMap((e) => (e.latest_submission ? [{ id: e.latest_submission.id, label: e.description, version: e.latest_submission.version }] : [])),
  );
  protected readonly reasonError = computed(() => (this.touched() && this.reason().trim().length === 0 ? 'COMPLIANCE.APPROVAL.RETURN.ERR_REASON' : null));
  readonly changed = computed(() => this.reason().trim().length > 0 || this.picked().length > 0);

  toggle(id: string, on: boolean): void {
    this.picked.update((list) => (on ? [...list, id] : list.filter((x) => x !== id)));
  }

  save(): void {
    if (this.sending()) return;
    this.touched.set(true);
    const reason = this.reason().trim();
    if (!reason) return;
    this.sending.set(true);
    this.banner.set(null);
    this.serverReason.set(null);
    const ids = this.picked();
    this.api.decide(this.detail().id, { decision: 'return', reason, ...(ids.length ? { returned_submission_ids: [...ids] } : {}) }, this.view.viewParam()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sending.set(false);
        this.returned.emit();
      },
      error: (e: unknown) => {
        this.sending.set(false);
        const code = apiErrorCode(e);
        const fields = apiFieldErrors(e);
        if (fields.length) this.serverReason.set(fields[0].message);
        const key = approvalErrorKey(code);
        this.banner.set(key ? this.translate.instant(key) : fields.length ? null : apiErrorMessage(e, this.translate.instant('COMPLIANCE.APPROVAL.SAVE_ERROR')));
        if (isStaleConflict(code)) this.stale.emit();
      },
    });
  }
}
