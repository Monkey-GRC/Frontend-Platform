import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { Tag } from '@shared/presentation/components/tag/tag';
import { DetailModal } from '@shared/presentation/components/detail-modal/detail-modal';
import { ClientList, includesText } from '@shared/domain/utils/client-list';
import { SearchField } from '@shared/presentation/components/search-field/search-field';
import { TabItem } from '@shared/presentation/components/tabs/tabs';
import { Badge } from '@shared/presentation/components/badge/badge';
import { Cause, CauseRiskRef, ControlLink } from '@shared/domain/models/risk.models';
import { ControlService } from '@features/compliance/domain/services/control.service';
import { RiskService } from '@shared/domain/services/risk.service';
import { DetailSection } from '@shared/presentation/components/detail-section/detail-section';
import { actionsColumn, LinkedDetailPanelBase } from '../detail-panel-base/detail-panel-base';
import { LinkPicker } from '../link-picker/link-picker';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type DetailTab = 'summary' | 'controls';

// El detalle de una causa (MD-124), en el modal de detalle ancho con pestañas (MD-499; la pestaña abierta va en `?tab=`, la pone la lista): los riesgos que origina y los controles que la mitigan. El administrador de la empresa puede vincular y quitar
// controles y dar de baja una causa propia; el resto de roles solo lee.
@Component({
  selector: 'app-cause-detail-panel',
  imports: [Badge, TranslatePipe, DetailModal, SearchField, DataTable, TableCell, Tag, ConfirmDialog, LinkPicker, DetailSection, Skeleton, SkeletonRegion],
  templateUrl: './cause-detail-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CauseDetailPanel extends LinkedDetailPanelBase<Cause, DetailTab, ControlLink> {
  private readonly api = inject(RiskService);
  private readonly controls = inject(ControlService);
  protected readonly tabIds = ['summary', 'controls'] as const;
  protected readonly saveErrorKey = 'COMPLIANCE.CAUSE_DETAIL.SAVE_ERROR';
  protected readonly noticeKeys = { linked: 'COMPLIANCE.CAUSE_DETAIL.LINKED', unlinked: 'COMPLIANCE.CAUSE_DETAIL.UNLINKED' };

  // Los riesgos que origina y los controles que la mitigan: listas compactas (la tabla única en su variante para paneles), con las acciones al extremo.
  readonly riskColumns: TableColumn<CauseRiskRef>[] = [
    { key: 'risk', headerKey: 'COMPLIANCE.CAUSE_DETAIL.RISKS_ORIGINATED' },
  ];
  readonly controlColumns: TableColumn<ControlLink>[] = [
    { key: 'control', headerKey: 'COMPLIANCE.CAUSE_DETAIL.MITIGATING_CONTROLS' },
    { key: 'kind', headerKey: 'COMPLIANCE.CAUSE_DETAIL.CONTROL_KIND' },
    actionsColumn(),
  ];
  readonly byId = (r: CauseRiskRef) => r.id;
  /** Los riesgos que origina y los controles que la mitigan, cada lista con su buscador (código o texto) y su paginación. */
  readonly riskList = new ClientList<CauseRiskRef>(
    computed(() => this.detail()?.risks ?? []),
    (r, q) => includesText(q, r.code, r.name),
  );
  readonly controlList = new ClientList<ControlLink>(
    computed(() => this.detail()?.controls ?? []),
    (k, q) => includesText(q, k.code, k.name),
  );

  /** El nombre accesible de cada fila, que abre el riesgo. */
  readonly riskLabel = (r: CauseRiskRef) => `${r.code} · ${r.name}`;
  readonly controlLabel = (k: ControlLink) => `${k.code} · ${k.name}`;
  readonly controlKey = (k: ControlLink) => k.control_id;

  readonly causeId = input.required<string>();
  /** Una fila de la lista de controles: la vista abre ese control en Controles. */
  readonly openControl = output<string>();
  readonly openRisk = output<string>();
  /** Se pidió editar esta causa propia: la vista abre el formulario. */
  readonly edit = output<Cause>();

  /** Resumen y Controles que la mitigan, con cuántas hay (MD-499). */
  readonly tabs = computed<TabItem[]>(() => {
    const d = this.ready();
    if (!d) return [];
    return [
      { id: 'summary', labelKey: 'COMPLIANCE.DETAIL_TABS.SUMMARY' },
      { id: 'controls', labelKey: 'COMPLIANCE.DETAIL_TABS.CONTROLS', count: d.controls.length },
    ];
  });

  /** El título de una causa sin nombre (las del catálogo v2): su código y, si la tiene, su clasificación, nunca la descripción repetida. */
  fallbackTitle(cause: Cause): string {
    const parts = [this.translate.instant('COMPLIANCE.CAUSE_DETAIL.TITLE_FALLBACK', { code: cause.code })];
    if (cause.cause_origin) parts.push(this.labels.of('COMPLIANCE.CAUSE_ORIGIN', cause.cause_origin));
    if (cause.cause_type) parts.push(this.labels.of('COMPLIANCE.CAUSE_TYPE', cause.cause_type));
    return parts.join(' · ');
  }

  /** «Editar» de la cabecera: la vista abre el formulario con este elemento. */
  editCurrent(): void {
    const d = this.detail();
    if (d) this.edit.emit(d);
  }

  protected override onRequest(): void {
    super.onRequest();
    this.riskList.reset();
    this.controlList.reset();
  }

  protected request() {
    return this.api.getCause(this.causeId(), this.view.viewParam());
  }

  protected remove() {
    return this.api.deactivateCause(this.causeId());
  }

  protected candidatesFor(cause: Cause) {
    const linked = new Set(cause.controls.map((k) => k.control_id));
    return this.controls.listAll(cause.service_id, this.view.viewParam()).pipe(
      map((all) => all.filter((c) => !linked.has(c.id)).map((c) => ({ id: c.id, label: [c.code, c.name].filter(Boolean).join(' · ') }))),
    );
  }

  protected linkCall(controlId: string) {
    return this.api.linkControl(this.causeId(), controlId);
  }

  protected unlinkCall(control: ControlLink) {
    return this.api.unlinkControl(this.causeId(), control.control_id);
  }
}
