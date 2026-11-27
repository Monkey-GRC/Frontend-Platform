import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, timeout } from 'rxjs';
import { LOAD_TIMEOUT_MS } from '@shared/domain/utils/load-timeout';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { LanguageService } from '@core/domain/services/language.service';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { isCompanyAdmin } from '@shared/domain/utils/roles';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { ExpandableText } from '@shared/presentation/components/expandable-text/expandable-text';
import { Card } from '@shared/presentation/components/card/card';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { ControlDetail, DecisionKind, LevelOverrideBody, ManagementException, ManagementManualTest, ManagementRequirement } from '@features/compliance/domain/models/control.models';
import { ControlManagementService } from '@features/compliance/domain/services/control-management.service';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { ManagementLabelsService } from '@shared/domain/services/management-labels.service';
import { approvalErrorKey, can, isStaleConflict, managementTone, personLabel } from '@features/compliance/domain/utils/control-approval';
import { ControlApplicabilitySection } from '../control-applicability-section/control-applicability-section';
import { ControlExceptionsSection } from '../control-exceptions-section/control-exceptions-section';
import { ControlHistory } from '../control-history/control-history';
import { ControlLevelForm } from '../control-level-form/control-level-form';
import { ControlLevelSection } from '../control-level-section/control-level-section';
import { ControlManualTests } from '../control-manual-tests/control-manual-tests';
import { ControlOccurrenceForm } from '../control-occurrence-form/control-occurrence-form';
import { ControlPlanForm, PlanDraft } from '../control-plan-form/control-plan-form';
import { ControlReasonForm } from '../control-reason-form/control-reason-form';
import { ControlResultForm } from '../control-result-form/control-result-form';
import { ControlReturnForm } from '../control-return-form/control-return-form';

/** Qué solicitud se rechaza: el nivel, un plan o un «No aplica». */
interface RejectTarget {
  what: 'level' | 'plan' | 'na';
  id: string;
}

// La pestaña «Aprobación» del detalle de un control (MD-505, D132, D140; MD-529): Estado, Nivel, Excepciones, Requisitos, Pruebas manuales e Historial, en ese orden. Los botones salen de
// `management.allowed_actions` (y las de cada elemento): esta pantalla no repite la matriz de permisos y el servidor vuelve a comprobar cada escritura.
// Aquí vive lo común: el diálogo abierto, la llamada, el aviso y la recarga del control tras cada acción.
@Component({
  selector: 'app-control-approval',
  imports: [
    TranslatePipe, Card, StatusIndicator, ConfirmDialog, ExpandableText, ControlLevelSection, ControlExceptionsSection, ControlApplicabilitySection, ControlManualTests, ControlHistory,
    ControlReturnForm, ControlResultForm, ControlLevelForm, ControlPlanForm, ControlOccurrenceForm, ControlReasonForm,
  ],
  templateUrl: './control-approval.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlApproval {
  private readonly api = inject(ControlService);
  private readonly management = inject(ControlManagementService);
  private readonly view = inject(ComplianceViewService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly labels = inject(ManagementLabelsService);
  protected readonly managementTone = managementTone;
  protected readonly can = can;

  readonly detail = input.required<ControlDetail>();
  /** El panel está volviendo a pedir el control tras un acto: nada se puede pulsar hasta que llegue. */
  readonly refreshing = input(false);
  /** «Ir a Evidencias»: el panel cambia de pestaña. */
  readonly goEvidence = output<void>();
  /** Algo cambió (o el control ya no está como se veía): el panel vuelve a pedir el control y la lista. */
  readonly changed = output<void>();

  // Un diálogo abierto a la vez; el que se abre guarda sobre qué.
  protected readonly approving = signal(false);
  protected readonly returning = signal(false);
  protected readonly changingLevel = signal(false);
  protected readonly rejecting = signal<RejectTarget | null>(null);
  protected readonly planFor = signal<ManagementException | null>(null);
  protected readonly notApplicableFor = signal<ManagementRequirement | null>(null);
  protected readonly revertFor = signal<ManagementRequirement | null>(null);
  protected readonly occurrenceFor = signal<ManagementRequirement | null>(null);
  protected readonly declareFor = signal<ManagementRequirement | null>(null);
  protected readonly resultFor = signal<ManagementManualTest | null>(null);

  protected readonly sending = signal(false);
  /** El acto de un botón que no abre formulario (`nivel:id`, `plan:id`, `na:id`): ese botón muestra el spinner hasta que el panel termina de recargar. */
  private readonly acting = signal<string | null>(null);
  /** Mientras se envía o se recarga, los demás actos del panel quedan deshabilitados. */
  protected readonly locked = computed(() => this.sending() || this.refreshing());
  /** El acto en curso, solo mientras el panel está ocupado. */
  protected readonly activeAct = computed(() => (this.locked() ? this.acting() : null));
  private wasLocked = false;

  constructor() {
    effect(() => {
      const locked = this.locked();
      untracked(() => {
        if (locked) {
          this.wasLocked = true;
          return;
        }
        // Terminó el acto y la recarga: ningún botón conserva el spinner y, si el foco se perdió, vuelve a un destino estable.
        this.acting.set(null);
        if (this.wasLocked) this.restoreFocus();
        this.wasLocked = false;
      });
    });
  }

  /** Un botón que se deshabilita (o un diálogo que se cierra) deja el foco en `body`: al terminar, vuelve a la pestaña, salvo que el foco esté dentro de un diálogo abierto. */
  private restoreFocus(): void {
    afterNextRender(() => {
      const active = document.activeElement as HTMLElement | null;
      const lost = !active || active === document.body || (this.host.nativeElement.contains(active) && (active.hasAttribute('disabled') || active.getAttribute('aria-disabled') === 'true'));
      if (lost) this.host.nativeElement.querySelector<HTMLElement>('[data-approval]')?.focus({ preventScroll: true });
    }, { injector: this.injector });
  }
  /** El error del servidor dentro del formulario abierto. */
  protected readonly banner = signal<string | null>(null);
  /** El error de una acción que no abre formulario (o cuyo diálogo ya se cerró). */
  protected readonly error = signal<string | null>(null);

  protected readonly allowed = computed(() => this.detail().management.allowed_actions);
  // Derivados del rol a propósito: el contrato (aprobacion.md, gestion.md) no expone el paso en `management` ni en `allowed_actions`; solo dice que el servidor lo decide según quien llama
  // (el paso aparece únicamente en el historial, `approval.step`). Si el backend lo expone, se lee de ahí. Es seguro: un `admin_empresa` que no lleva el control no recibe `propose_level` ni
  // `register_plan` en `allowed_actions`, así que `direct` solo se usa cuando de verdad lo lleva.
  /** El administrador que lleva el control propone y decide en un solo acto: lo que registra nace aprobado. */
  protected readonly direct = computed(() => isCompanyAdmin(this.view.role()));
  /** La primera aprobación es del responsable; la del administrador es la final. */
  protected readonly finalStep = computed(() => isCompanyAdmin(this.view.role()));

  /** La línea de ayuda del estado, con su clave y sus datos. */
  protected readonly help = computed(() => {
    const d = this.detail();
    const m = d.management;
    const date = (iso: string | null) => (iso ? this.day(iso) : '—');
    const out = (key: string, params: Record<string, string> = {}) => ({ key, params });
    switch (d.management_state) {
      case 'returned':
        return out('COMPLIANCE.APPROVAL.HELP.RETURNED', { name: personLabel(m.returned_by), reason: m.returned_reason ?? '' });
      case 'pending_approval':
        return out(can(m.allowed_actions, 'approve') ? 'COMPLIANCE.APPROVAL.HELP.PENDING_APPROVAL_YOU' : 'COMPLIANCE.APPROVAL.HELP.PENDING_APPROVAL');
      case 'owner_approved':
        return out('COMPLIANCE.APPROVAL.HELP.OWNER_APPROVED', { name: personLabel(m.owner_approved_by), date: date(m.owner_approved_at) });
      case 'approved':
        return m.owner_approved_by && m.approved_by && m.owner_approved_by.id !== m.approved_by.id
          ? out('COMPLIANCE.APPROVAL.HELP.APPROVED_TWO', { owner: personLabel(m.owner_approved_by), admin: personLabel(m.approved_by) })
          : out('COMPLIANCE.APPROVAL.HELP.APPROVED_ONE', { name: personLabel(m.approved_by ?? m.owner_approved_by), date: date(m.approved_at ?? m.owner_approved_at) });
      case 'in_progress':
        return out('COMPLIANCE.APPROVAL.HELP.IN_PROGRESS');
      default:
        return out('COMPLIANCE.APPROVAL.HELP.NON_COMPLIANT');
    }
  });

  protected day(iso: string): string {
    return formatLocalDate(iso, this.language.current()) || iso;
  }

  private closeAll(): void {
    this.approving.set(false);
    this.returning.set(false);
    this.changingLevel.set(false);
    this.rejecting.set(null);
    this.planFor.set(null);
    this.notApplicableFor.set(null);
    this.revertFor.set(null);
    this.occurrenceFor.set(null);
    this.declareFor.set(null);
    this.resultFor.set(null);
    this.banner.set(null);
  }

  protected close(): void {
    this.closeAll();
  }

  /** Abre un diálogo: limpia lo que había y los errores. */
  protected open<T>(target: { set(value: T): void }, value: T): void {
    if (this.locked()) return;
    this.closeAll();
    this.error.set(null);
    target.set(value);
  }

  /** Hace la llamada de la acción: con formulario abierto, un error se queda en el formulario; sin él, en la pestaña. */
  private run(call: Observable<unknown>, doneKey: string, act: string | null = null): void {
    if (this.sending()) return;
    this.acting.set(act);
    this.sending.set(true);
    this.banner.set(null);
    this.error.set(null);
    call.pipe(timeout(LOAD_TIMEOUT_MS), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sending.set(false);
        this.closeAll();
        this.toast.showSuccess(this.translate.instant(doneKey));
        this.changed.emit();
      },
      error: (e: unknown) => {
        this.sending.set(false);
        this.acting.set(null);
        const code = apiErrorCode(e);
        const key = approvalErrorKey(code);
        const ownerInvalid = apiFieldErrors(e).some((f) => f.code === 'owner_id.invalid' || f.field === 'owner_id');
        const message = ownerInvalid ? this.translate.instant('COMPLIANCE.APPROVAL.PLAN.ERR_OWNER') : key ? this.translate.instant(key) : apiErrorMessage(e, this.translate.instant('COMPLIANCE.APPROVAL.SAVE_ERROR'));
        const inForm = this.formOpen();
        if (inForm) this.banner.set(message);
        else this.error.set(message);
        // Sin respuesta a tiempo no se sabe si el acto se hizo: se vuelve a pedir el control.
        if (e instanceof Error && e.name === 'TimeoutError') this.changed.emit();
        if (isStaleConflict(code)) {
          if (!inForm) this.closeAll();
          this.changed.emit();
        }
      },
    });
  }

  /** ¿Hay un formulario abierto (no la confirmación de aprobar)? */
  private formOpen(): boolean {
    return !!(this.changingLevel() || this.rejecting() || this.planFor() || this.notApplicableFor() || this.revertFor() || this.occurrenceFor() || this.resultFor() || this.returning());
  }

  protected confirmApprove(): void {
    this.run(this.api.decide(this.detail().id, { decision: 'approve' }, this.view.viewParam()), 'COMPLIANCE.APPROVAL.APPROVE.DONE');
  }

  protected onReturned(): void {
    this.closeAll();
    this.toast.showSuccess(this.translate.instant('COMPLIANCE.APPROVAL.RETURN.DONE'));
    this.changed.emit();
  }

  protected onResultSaved(): void {
    this.closeAll();
    this.toast.showSuccess(this.translate.instant('COMPLIANCE.APPROVAL.RESULT.DONE'));
    this.changed.emit();
  }

  protected submitLevel(v: LevelOverrideBody): void {
    this.run(this.management.proposeLevel(this.detail().id, v), this.direct() ? 'COMPLIANCE.APPROVAL.LEVEL.DONE_DIRECT' : 'COMPLIANCE.APPROVAL.LEVEL.DONE');
  }

  protected submitPlan(draft: PlanDraft): void {
    const ex = this.planFor();
    if (ex) this.run(this.management.registerPlan(this.detail().id, { test_id: ex.test.id, ...draft }), this.direct() ? 'COMPLIANCE.APPROVAL.PLAN.DONE_DIRECT' : 'COMPLIANCE.APPROVAL.PLAN.DONE');
  }

  protected submitNotApplicable(reason: string): void {
    const req = this.notApplicableFor();
    if (req) this.run(this.management.requestNotApplicable(this.detail().id, req.id, reason), 'COMPLIANCE.APPROVAL.REQUIREMENTS.DONE_REQUEST');
  }

  protected submitRevert(reason: string): void {
    const req = this.revertFor();
    if (req) this.run(this.management.revertNotApplicable(this.detail().id, req.id, reason), 'COMPLIANCE.APPROVAL.REQUIREMENTS.DONE_REVERT');
  }

  protected submitOccurrence(body: { occurred_on: string; description: string }): void {
    const req = this.occurrenceFor();
    if (req) this.run(this.management.registerOccurrence(this.detail().id, req.id, body), 'COMPLIANCE.APPROVAL.OCCURRENCE.DONE');
  }

  protected confirmDeclare(): void {
    const req = this.declareFor();
    if (req) this.run(this.management.declareNoOccurrences(this.detail().id, req.id), 'COMPLIANCE.APPROVAL.REQUIREMENTS.DONE_DECLARE');
  }

  /** Aprobar va directo; rechazar pide el motivo. */
  protected decide(what: RejectTarget['what'], target: { id: string; decision: DecisionKind }): void {
    if (target.decision === 'reject') return this.open(this.rejecting, { what, id: target.id });
    if (this.locked()) return;
    this.run(this.decisionCall(what, target.id, { decision: 'approve' }), 'COMPLIANCE.APPROVAL.DECIDE.APPROVED', `${what}:${target.id}`);
  }

  protected submitReject(reason: string): void {
    const target = this.rejecting();
    if (target) this.run(this.decisionCall(target.what, target.id, { decision: 'reject', reason }), 'COMPLIANCE.APPROVAL.DECIDE.REJECTED');
  }

  private decisionCall(what: RejectTarget['what'], id: string, body: { decision: DecisionKind; reason?: string }): Observable<unknown> {
    if (what === 'level') return this.management.decideLevel(id, body);
    return what === 'plan' ? this.management.decidePlan(id, body) : this.management.decideNotApplicable(id, body);
  }
}
