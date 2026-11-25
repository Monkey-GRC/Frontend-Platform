import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { Badge } from '@shared/presentation/components/badge/badge';
import { Tag } from '@shared/presentation/components/tag/tag';
import { DetailModal } from '@shared/presentation/components/detail-modal/detail-modal';
import { ClientList, includesText } from '@shared/domain/utils/client-list';
import { SearchField } from '@shared/presentation/components/search-field/search-field';
import { targetChecked } from '@shared/presentation/utils/event-target';
import { TabItem } from '@shared/presentation/components/tabs/tabs';
import { RiskCauseNode, RiskDetail } from '@shared/domain/models/risk.models';
import { RiskService } from '@shared/domain/services/risk.service';
import { DetailSection } from '@shared/presentation/components/detail-section/detail-section';
import { actionsColumn, LinkedDetailPanelBase } from '../detail-panel-base/detail-panel-base';
import { LinkPicker } from '../link-picker/link-picker';
import { RiskAssessment } from '../risk-assessment/risk-assessment';
import { RiskLevelBadge } from '@shared/presentation/components/risk-level-badge/risk-level-badge';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type DetailTab = 'summary' | 'causes';

// El detalle de un riesgo (MD-124), en el modal de detalle ancho con pestañas (MD-499; la pestaña abierta va en `?tab=`, la pone la lista): su descripción, el impacto potencial, y el árbol de causas con los controles que las mitigan. El administrador de la
// empresa puede vincular y quitar causas y dar de baja un riesgo propio; el resto de roles solo lee. La evaluación 5×5 y el tratamiento los trae `app-risk-assessment` (MD-123).
@Component({
  selector: 'app-risk-detail-panel',
  imports: [Badge, TranslatePipe, DetailModal, SearchField, DataTable, TableCell, Tag, ConfirmDialog, LinkPicker, RiskLevelBadge, RiskAssessment, DetailSection, Skeleton, SkeletonRegion],
  templateUrl: './risk-detail-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskDetailPanel extends LinkedDetailPanelBase<RiskDetail, DetailTab, RiskCauseNode> {
  private readonly assessment = viewChild(RiskAssessment);
  /** MD-485 · Una evaluación o un tratamiento a medio escribir: cerrar el panel pide confirmar antes de descartarlo. */
  readonly editing = computed(() => this.assessment()?.dirty() ?? false);

  private readonly api = inject(RiskService);
  protected readonly tabIds = ['summary', 'causes'] as const;
  protected readonly saveErrorKey = 'COMPLIANCE.RISK_DETAIL.SAVE_ERROR';
  protected readonly noticeKeys = { linked: 'COMPLIANCE.RISK_DETAIL.LINKED', unlinked: 'COMPLIANCE.RISK_DETAIL.UNLINKED' };

  // Las causas del riesgo: una lista compacta (la tabla única en su variante para paneles) con la causa y sus controles a un lado y las acciones al otro.
  readonly causeColumns: TableColumn<RiskCauseNode>[] = [
    { key: 'cause', headerKey: 'COMPLIANCE.GLOSSARY.CAUSES' },
    { key: 'controls', headerKey: 'COMPLIANCE.CAUSE_DETAIL.MITIGATING_CONTROLS', class: 'w-2/5' },
    actionsColumn(),
  ];
  readonly causeKey = (c: RiskCauseNode) => c.id;
  /** Cuántos controles de una causa se ven sin desplegar; el resto, con «+K más». */
  protected readonly CONTROLS_SHOWN = 4;
  readonly onlyWithoutControls = signal(false);
  private readonly expandedCauses = signal<ReadonlySet<string>>(new Set());
  protected readonly targetChecked = targetChecked;

  /** Las causas con buscador (código o texto de la causa o de sus controles), el filtro «solo sin controles» y paginación. */
  readonly causeList = new ClientList<RiskCauseNode>(
    computed(() => this.detail()?.causes ?? []),
    (c, q) => (!this.onlyWithoutControls() || c.controls.length === 0) && (includesText(q, c.code, c.name) || c.controls.some((k) => includesText(q, k.code, k.name))),
  );

  protected setOnlyWithout(value: boolean): void {
    this.onlyWithoutControls.set(value);
    this.causeList.restart();
  }

  protected isExpanded(causeId: string): boolean {
    return this.expandedCauses().has(causeId);
  }

  protected toggleControls(causeId: string): void {
    this.expandedCauses.update((set) => {
      const next = new Set(set);
      if (!next.delete(causeId)) next.add(causeId);
      return next;
    });
  }

  protected visibleControls(c: RiskCauseNode): RiskCauseNode['controls'] {
    return this.isExpanded(c.id) ? c.controls : c.controls.slice(0, this.CONTROLS_SHOWN);
  }

  /** El nombre del control y si es obligatorio u opcional, y su efecto: el tooltip del código y el texto para lectores de pantalla. */
  protected controlTitle(k: RiskCauseNode['controls'][number]): string {
    const parts = [`${k.code} · ${k.name}`, this.translate.instant(k.is_mandatory ? 'COMPLIANCE.RISK_DETAIL.MANDATORY' : 'COMPLIANCE.RISK_DETAIL.OPTIONAL')];
    if (k.effect) parts.push(this.labels.of('COMPLIANCE.CAUSE_EFFECT', k.effect));
    return parts.join(' · ');
  }

  /** El nombre accesible de cada fila, que abre la causa: su código y, si tiene, su nombre. */
  readonly causeLabel = (c: RiskCauseNode) => [c.code, c.name].filter(Boolean).join(' · ');

  readonly riskId = input.required<string>();
  readonly openCause = output<string>();
  /** Se pidió editar este riesgo propio: la vista abre el formulario. */
  readonly edit = output<RiskDetail>();

  /** Resumen y Causas, con cuántas hay (MD-499). */
  readonly tabs = computed<TabItem[]>(() => {
    const d = this.ready();
    if (!d) return [];
    return [
      { id: 'summary', labelKey: 'COMPLIANCE.DETAIL_TABS.SUMMARY' },
      { id: 'causes', labelKey: 'COMPLIANCE.DETAIL_TABS.CAUSES', count: d.causes.length },
    ];
  });

  /** «Editar» de la cabecera: la vista abre el formulario con este elemento. */
  editCurrent(): void {
    const d = this.detail();
    if (d) this.edit.emit(d);
  }

  /** Se evaluó o se trató el riesgo: el detalle y la lista se vuelven a pedir. */
  assessed(): void {
    this.load();
    this.changed.emit();
  }

  protected override onRequest(): void {
    super.onRequest();
    this.onlyWithoutControls.set(false);
    this.expandedCauses.set(new Set());
    this.causeList.reset();
  }

  protected request() {
    return this.api.getRisk(this.riskId(), this.view.viewParam());
  }

  protected remove() {
    return this.api.deactivateRisk(this.riskId());
  }

  protected candidatesFor(risk: RiskDetail) {
    const linked = new Set(risk.causes.map((c) => c.id));
    return this.api.listAllCauses(risk.service_id, this.view.viewParam()).pipe(
      map((all) => all.filter((c) => c.is_active && !linked.has(c.id)).map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }))),
    );
  }

  protected linkCall(causeId: string) {
    return this.api.linkCause(this.riskId(), causeId);
  }

  protected unlinkCall(cause: RiskCauseNode) {
    return this.api.unlinkCause(this.riskId(), cause.id);
  }
}
