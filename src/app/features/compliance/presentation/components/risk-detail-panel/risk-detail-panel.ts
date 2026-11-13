import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { Badge } from '@shared/presentation/components/badge/badge';
import { Tag } from '@shared/presentation/components/tag/tag';
import { SideDrawer } from '@shared/presentation/components/side-drawer/side-drawer';
import { RiskCauseNode, RiskDetail } from '@shared/domain/models/risk.models';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { DetailCard } from '../detail-card/detail-card';
import { LinkPicker, PickerItem } from '../link-picker/link-picker';
import { RiskAssessment } from '../risk-assessment/risk-assessment';
import { RiskLevelBadge } from '@shared/presentation/components/risk-level-badge/risk-level-badge';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type Stage = 'loading' | 'error' | 'ready';

// El detalle de un riesgo (MD-124): su descripción, el impacto potencial, y el árbol de causas con los controles que las mitigan. El administrador de la
// empresa puede vincular y quitar causas y dar de baja un riesgo propio; el resto de roles solo lee. La evaluación 5×5 y el tratamiento los trae `app-risk-assessment` (MD-123).
@Component({
  selector: 'app-risk-detail-panel',
  imports: [Badge, TranslatePipe, SideDrawer, DataTable, TableCell, Tag, ConfirmDialog, LinkPicker, RiskLevelBadge, RiskAssessment, DetailCard, Skeleton, SkeletonRegion],
  templateUrl: './risk-detail-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskDetailPanel {
  private readonly api = inject(RiskService);
  private readonly translate = inject(TranslateService);
  readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  // Las causas del riesgo: una lista compacta (la tabla única en su variante para paneles) con la causa y sus controles a un lado y las acciones al otro.
  readonly causeColumns: TableColumn<RiskCauseNode>[] = [
    { key: 'cause', headerKey: 'COMPLIANCE.GLOSSARY.CAUSES' },
    { key: 'actions', headerKey: 'COMMON.TABLE.ACTIONS', align: 'right', srOnlyHeader: true },
  ];
  readonly causeKey = (c: RiskCauseNode) => c.id;

  readonly riskId = input.required<string>();
  readonly closed = output<void>();
  // El riesgo cambió (un vínculo nuevo o quitado, o una baja): la lista se vuelve a pedir.
  readonly changed = output<void>();
  readonly openCause = output<string>();
  /** Se pidió editar este riesgo propio: la vista abre el formulario. */
  readonly edit = output<RiskDetail>();


  readonly stage = signal<Stage>('loading');
  readonly detail = signal<RiskDetail | null>(null);
  readonly saving = signal(false);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly picking = signal(false);
  readonly candidates = signal<PickerItem[]>([]);
  readonly confirmingRemove = signal(false);
  readonly unlinking = signal<RiskCauseNode | null>(null);

  /** Dar de baja es solo de un riesgo propio; los del catálogo no se quitan desde la pantalla. */
  readonly canRemove = computed(() => this.view.canManage() && this.detail()?.origin === 'own');

  constructor() {
    effect(() => {
      this.riskId();
      this.view.viewParam();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.stage.set('loading');
    this.api.getRisk(this.riskId(), this.view.viewParam()).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  /** Se evaluó o se trató el riesgo: el detalle y la lista se vuelven a pedir. */
  assessed(): void {
    this.load();
    this.changed.emit();
  }

  startLink(): void {
    const d = this.detail();
    if (!d) return;
    this.reset();
    this.picking.set(true);
    const linked = new Set(d.causes.map((c) => c.id));
    this.api.listAllCauses(d.service_id, this.view.viewParam()).subscribe({
      next: (all) => this.candidates.set(all.filter((c) => c.is_active && !linked.has(c.id)).map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }))),
      error: () => this.fail(null),
    });
  }

  link(causeId: string): void {
    this.run(this.api.linkCause(this.riskId(), causeId), 'COMPLIANCE.RISK_DETAIL.LINKED', () => this.picking.set(false));
  }

  askUnlink(cause: RiskCauseNode): void {
    this.reset();
    this.unlinking.set(cause);
  }

  confirmUnlink(): void {
    const cause = this.unlinking();
    if (!cause) return;
    this.run(this.api.unlinkCause(this.riskId(), cause.id), 'COMPLIANCE.RISK_DETAIL.UNLINKED', () => this.unlinking.set(null));
  }

  askRemove(): void {
    this.reset();
    this.confirmingRemove.set(true);
  }

  confirmRemove(): void {
    this.saving.set(true);
    this.api.deactivateRisk(this.riskId()).subscribe({
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
    // `message` ya viene traducido por el backend (409: vínculo repetido, riesgo dado de baja…).
    this.error.set(apiErrorMessage(error, this.translate.instant('COMPLIANCE.RISK_DETAIL.SAVE_ERROR')));
  }

  private reset(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
