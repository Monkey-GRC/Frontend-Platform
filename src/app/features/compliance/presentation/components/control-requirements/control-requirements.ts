import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { ControlRequirement, ControlTechnical, RequirementTest } from '@features/compliance/domain/models/control.models';
import { RoleGroup, groupByRole, statusTone, summarizeRequirements } from '@features/compliance/domain/utils/control-v2-look';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { SearchField } from '@shared/presentation/components/search-field/search-field';
import { ClientList, includesText } from '@shared/domain/utils/client-list';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';

interface TestRow extends RequirementTest {
  groups: RoleGroup[];
}
interface RequirementRow extends Omit<ControlRequirement, 'tests'> {
  tests: TestRow[];
}

// Los requisitos del control (R1 a R6, vista técnica): cuáles cumplen y cuáles faltan, con sus pruebas y, en las técnicas, sus checks por rol.
// Todo viene calculado por el backend; aquí solo se muestra. El período auditado va aparte, en `app-control-period` (su propia pestaña del detalle, MD-499).
@Component({
  selector: 'app-control-requirements',
  imports: [TranslatePipe, StatusIndicator, Tag, DataTable, TableCell, OptionChips, SearchField, EmptyState],
  templateUrl: './control-requirements.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlRequirements {
  protected readonly labels = inject(EnumLabelService);
  private readonly language = inject(LanguageService);
  protected readonly statusTone = statusTone;

  readonly technical = input.required<ControlTechnical>();

  protected readonly rows = computed<RequirementRow[]>(() =>
    (this.technical().requirements ?? []).map((r) => ({ ...r, tests: r.tests.map((t) => ({ ...t, groups: groupByRole(t.check_links ?? []) })) })),
  );
  protected readonly summary = computed(() => summarizeRequirements(this.technical().requirements ?? []));

  // Los estados que existen en los datos (no una lista escrita a mano) como filtro; el texto busca en el código, el enunciado y las pruebas.
  protected readonly status = signal<string | null>(null);
  protected readonly statusChips = computed(() => [
    { value: 'all', label: this.labels.of('COMPLIANCE.REQS', 'ALL') },
    ...[...new Set(this.rows().map((r) => r.status))].map((v) => ({ value: v, label: this.labels.of('COMPLIANCE.REQUIREMENT_STATUS', v) })),
  ]);
  protected readonly list = new ClientList<RequirementRow>(
    this.rows,
    (r, q) => (!this.status() || r.status === this.status()) && includesText(q, r.code, r.text, ...r.tests.flatMap((t) => [t.test_code, t.display_name])),
  );
  protected readonly columns: TableColumn<RequirementRow>[] = [
    { key: 'requirement', headerKey: 'COMPLIANCE.REQS.COL_REQUIREMENT', skeleton: 'lines' },
    { key: 'status', headerKey: 'COMPLIANCE.REQS.COL_STATUS', class: 'w-44', skeleton: 'badge' },
    { key: 'tests', headerKey: 'COMPLIANCE.REQS.COL_TESTS', skeleton: 'lines' },
  ];
  protected readonly rowKey = (r: RequirementRow) => r.id;

  protected pickStatus(value: string): void {
    this.status.set(value === 'all' || value === this.status() ? null : value);
    this.list.restart();
  }

  protected clearFilters(): void {
    this.status.set(null);
    this.list.search('');
  }

  /** Una fecha `AAAA-MM-DD` del backend, en el idioma de la sesión y sin correrla un día por la zona horaria. */
  protected date(iso: string | null): string {
    if (!iso) return '';
    return formatLocalDate(iso, this.language.current(), { calendar: true }) || iso;
  }

  protected moduleKey(module: string | null): string {
    return module ?? 'other';
  }
}
