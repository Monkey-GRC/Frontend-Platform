import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { Tag } from '@shared/presentation/components/tag/tag';
import { SideDrawer } from '@shared/presentation/components/side-drawer/side-drawer';
import { Badge } from '@shared/presentation/components/badge/badge';
import { Cause, CauseRiskRef, ControlLink } from '@shared/domain/models/risk.models';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { DetailCard } from '../detail-card/detail-card';
import { LinkPicker, PickerItem } from '../link-picker/link-picker';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type Stage = 'loading' | 'error' | 'ready';

// El detalle de una causa (MD-124): los riesgos que origina y los controles que la mitigan. El administrador de la empresa puede vincular y quitar
// controles y dar de baja una causa propia; el resto de roles solo lee.
@Component({
  selector: 'app-cause-detail-panel',
  imports: [Badge, TranslatePipe, SideDrawer, DataTable, TableCell, Tag, ConfirmDialog, LinkPicker, DetailCard, Skeleton, SkeletonRegion],
  templateUrl: './cause-detail-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CauseDetailPanel {
  private readonly api = inject(RiskService);
  private readonly controls = inject(ControlService);
  private readonly translate = inject(TranslateService);
  readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  // Los riesgos que origina y los controles que la mitigan: listas compactas (la tabla única en su variante para paneles), con las acciones al extremo.
  readonly riskColumns: TableColumn<CauseRiskRef>[] = [
    { key: 'risk', headerKey: 'COMPLIANCE.CAUSE_DETAIL.RISKS_ORIGINATED' },
    { key: 'actions', headerKey: 'COMMON.TABLE.ACTIONS', align: 'right', srOnlyHeader: true },
  ];
  readonly controlColumns: TableColumn<ControlLink>[] = [
    { key: 'control', headerKey: 'COMPLIANCE.CAUSE_DETAIL.MITIGATING_CONTROLS' },
    { key: 'actions', headerKey: 'COMMON.TABLE.ACTIONS', align: 'right', srOnlyHeader: true },
  ];
  readonly byId = (r: CauseRiskRef) => r.id;
  readonly controlKey = (k: ControlLink) => k.control_id;

  readonly causeId = input.required<string>();
  readonly closed = output<void>();
  // La causa cambió (un control vinculado o quitado, o una baja): la lista se vuelve a pedir.
  readonly changed = output<void>();
  readonly openRisk = output<string>();
  /** Se pidió editar esta causa propia: la vista abre el formulario. */
  readonly edit = output<Cause>();


  readonly stage = signal<Stage>('loading');
  readonly detail = signal<Cause | null>(null);
  readonly saving = signal(false);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly picking = signal(false);
  readonly candidates = signal<PickerItem[]>([]);
  readonly confirmingRemove = signal(false);
  readonly unlinking = signal<ControlLink | null>(null);

  /** Dar de baja es solo de una causa propia; las del catálogo no se quitan desde la pantalla. */
  readonly canRemove = computed(() => this.view.canManage() && this.detail()?.origin === 'own');

  constructor() {
    effect(() => {
      this.causeId();
      this.view.viewParam();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.stage.set('loading');
    this.api.getCause(this.causeId(), this.view.viewParam()).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  startLink(): void {
    const d = this.detail();
    if (!d) return;
    this.reset();
    this.picking.set(true);
    const linked = new Set(d.controls.map((k) => k.control_id));
    this.controls.listAll(d.service_id, this.view.viewParam()).subscribe({
      next: (all) =>
        this.candidates.set(
          all.filter((c) => !linked.has(c.id)).map((c) => ({ id: c.id, label: [c.code, c.name].filter(Boolean).join(' · ') })),
        ),
      error: () => this.fail(null),
    });
  }

  link(controlId: string): void {
    this.run(this.api.linkControl(this.causeId(), controlId), 'COMPLIANCE.CAUSE_DETAIL.LINKED', () => this.picking.set(false));
  }

  askUnlink(control: ControlLink): void {
    this.reset();
    this.unlinking.set(control);
  }

  confirmUnlink(): void {
    const control = this.unlinking();
    if (!control) return;
    this.run(this.api.unlinkControl(this.causeId(), control.control_id), 'COMPLIANCE.CAUSE_DETAIL.UNLINKED', () => this.unlinking.set(null));
  }

  askRemove(): void {
    this.reset();
    this.confirmingRemove.set(true);
  }

  confirmRemove(): void {
    this.saving.set(true);
    this.api.deactivateCause(this.causeId()).subscribe({
      next: () => {
        this.saving.set(false);
        this.changed.emit();
        this.closed.emit();
      },
      error: (e) => {
        this.confirmingRemove.set(false);
        this.fail(e);
      },
    });
  }

  private run(call: Observable<unknown>, noticeKey: string, done: () => void): void {
    this.saving.set(true);
    this.reset();
    call.subscribe({
      next: () => {
        this.saving.set(false);
        done();
        this.notice.set(this.translate.instant(noticeKey));
        this.load();
        this.changed.emit();
      },
      error: (e) => {
        this.unlinking.set(null);
        this.fail(e);
      },
    });
  }

  private fail(error: unknown): void {
    this.saving.set(false);
    // `message` ya viene traducido por el backend (409: vínculo repetido, causa dada de baja…).
    this.error.set(apiErrorMessage(error, this.translate.instant('COMPLIANCE.CAUSE_DETAIL.SAVE_ERROR')));
  }

  private reset(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
