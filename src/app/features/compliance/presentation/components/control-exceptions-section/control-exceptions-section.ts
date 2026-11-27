import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { ControlDetailManagement, DecisionKind, ManagementException } from '@features/compliance/domain/models/control.models';
import { ManagementLabelsService } from '@shared/domain/services/management-labels.service';
import { can, personLabel, requestTone } from '@features/compliance/domain/utils/control-approval';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { Busy } from '@shared/presentation/directives/busy';
import { DetailSection } from '@shared/presentation/components/detail-section/detail-section';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { ExpandableText } from '@shared/presentation/components/expandable-text/expandable-text';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';

// «Excepciones» (D140 punto 4): una por prueba en excepción, con su plan de remediación (qué, quién y para cuándo) y lo que el servidor dejó hacer sobre ella.
// Una tabla de solo lectura con las celdas arriba: el «qué» del plan en 2 líneas con «Ver más», responsable y fecha límite como metadatos; los botones, a la derecha en una línea.
@Component({
  selector: 'app-control-exceptions-section',
  imports: [TranslatePipe, DetailSection, StatusIndicator, Tag, Busy, DataTable, TableCell, ExpandableText],
  templateUrl: './control-exceptions-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlExceptionsSection {
  protected readonly labels = inject(ManagementLabelsService);
  private readonly language = inject(LanguageService);
  protected readonly requestTone = requestTone;
  protected readonly personLabel = personLabel;
  protected readonly can = can;

  readonly management = input.required<ControlDetailManagement>();
  readonly busy = input(false);
  readonly acting = input<string | null>(null);
  readonly registerPlan = output<ManagementException>();
  readonly decide = output<{ id: string; decision: DecisionKind }>();

  private readonly enums = inject(EnumLabelService);

  protected readonly exceptions = computed(() => this.management().exceptions);
  /** La columna de acciones solo si alguna excepción tiene algo que hacer: sin ella, el plan ocupa el ancho. */
  private readonly hasActions = computed(() => this.exceptions().some((e) => can(e.allowed_actions, 'register_plan') || (can(e.allowed_actions, 'decide_plan') && !!e.plan)));
  protected readonly columns = computed<TableColumn<ManagementException>[]>(() => [
    { key: 'test', headerKey: 'COMPLIANCE.APPROVAL.EXCEPTIONS.COL_TEST', class: 'lg:w-1/3', skeleton: 'lines' },
    { key: 'plan', headerKey: 'COMPLIANCE.APPROVAL.EXCEPTIONS.COL_PLAN', skeleton: 'lines' },
    ...(this.hasActions() ? [{ key: 'actions', headerKey: 'COMMON.TABLE.ACTIONS', align: 'right' as const, class: 'lg:w-px whitespace-nowrap', srOnlyHeader: true, skeleton: 'actions' as const }] : []),
  ]);
  protected readonly rowKey = (e: ManagementException) => e.test.id;
  /** El estado de la prueba: todas las de esta sección están en excepción (`test_status`). */
  protected readonly exceptionLabel = () => this.enums.of('COMPLIANCE.TEST_STATUS', 'exception');

  protected day(iso: string): string {
    return formatLocalDate(iso, this.language.current(), { calendar: true }) || iso;
  }
}
