import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { ControlDetailManagement, ManagementManualTest } from '@features/compliance/domain/models/control.models';
import { ManagementLabelsService } from '@shared/domain/services/management-labels.service';
import { can, personLabel } from '@features/compliance/domain/utils/control-approval';
import { statusTone } from '@features/compliance/domain/utils/control-v2-look';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { DetailSection } from '@shared/presentation/components/detail-section/detail-section';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { ExpandableText } from '@shared/presentation/components/expandable-text/expandable-text';

// «Pruebas manuales» (D140): cada prueba manual del control con su estado, su último resultado real (quién y cuándo) y, si el servidor lo deja, «Registrar resultado».
@Component({
  selector: 'app-control-manual-tests',
  imports: [TranslatePipe, DetailSection, DataTable, TableCell, StatusIndicator, ExpandableText],
  templateUrl: './control-manual-tests.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlManualTests {
  protected readonly labels = inject(ManagementLabelsService);
  protected readonly enums = inject(EnumLabelService);
  private readonly language = inject(LanguageService);
  protected readonly statusTone = statusTone;
  protected readonly personLabel = personLabel;

  readonly management = input.required<ControlDetailManagement>();
  readonly busy = input(false);
  readonly registerResult = output<ManagementManualTest>();

  protected readonly rows = computed(() => this.management().manual_tests);
  protected readonly canRegister = computed(() => this.rows().some((t) => can(t.allowed_actions, 'register_result')));
  protected readonly columns = computed<TableColumn<ManagementManualTest>[]>(() => [
    { key: 'name', headerKey: 'COMPLIANCE.APPROVAL.TESTS.COL_NAME', skeleton: 'lines' },
    { key: 'status', headerKey: 'COMPLIANCE.APPROVAL.TESTS.COL_STATUS', skeleton: 'badge' },
    // El resultado con ancho fijo (su texto se corta dentro, nunca empuja la tabla); la acción al ancho de su botón, en una línea; «Nombre» se queda con el resto.
    { key: 'result', headerKey: 'COMPLIANCE.APPROVAL.TESTS.COL_RESULT', class: 'lg:w-80', skeleton: 'lines' },
    ...(this.canRegister() ? [{ key: 'actions', headerKey: 'COMMON.TABLE.ACTIONS', align: 'right' as const, class: 'lg:w-px whitespace-nowrap', srOnlyHeader: true, skeleton: 'actions' as const }] : []),
  ]);
  protected readonly rowKey = (t: ManagementManualTest) => t.test.id;
  protected readonly rowLabel = (t: ManagementManualTest) => `${t.test.code} ${t.test.display_name}`;
  protected readonly can = can;

  /** «Pendiente» porque su requisito «cuando ocurra» tiene casos del trimestre sin evidencia: sin ella la prueba no se mide. */
  protected missingEvidence(t: ManagementManualTest): boolean {
    if (t.status !== 'pending' || !t.requirement_id) return false;
    const req = this.management().requirements.find((r) => r.id === t.requirement_id);
    return (req?.on_demand?.occurrences_without_evidence ?? 0) > 0;
  }

  protected day(iso: string): string {
    return formatLocalDate(iso, this.language.current()) || iso;
  }
}
