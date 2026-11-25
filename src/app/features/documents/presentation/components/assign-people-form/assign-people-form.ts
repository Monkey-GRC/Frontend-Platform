import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorCode, apiErrorData, apiErrorMessage } from '@core/domain/utils/api-error';
import { TeamMember, TeamRole } from '@shared/domain/models/team.models';
import { TeamService } from '@shared/domain/services/team.service';
import { ClientList, includesText } from '@shared/domain/utils/client-list';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { PersonCell } from '@shared/presentation/components/person-cell/person-cell';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { TableFilter, TableFilterOption } from '@shared/presentation/components/table-filter/table-filter';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { MAX_ASSIGNEES } from '@features/documents/domain/models/document.models';
import { DocumentService } from '@features/documents/domain/services/document.service';

type Stage = 'loading' | 'error' | 'ready';

/** Quién puede recibir un documento (contracts/documentos.md → asignar): `admin_empresa`, `responsable`, `delegado` y `colaborador`, con cuenta activa o pendiente. El auditor no acepta (D133). */
const ASSIGNABLE_ROLES: readonly TeamRole[] = ['admin_empresa', 'responsable', 'delegado', 'colaborador'];

// Asignar un documento a personas, en lote (D152, MD-503): se busca en la lista de la empresa, se marcan las personas (también en varias páginas) y se envían juntas; es todo o nada.
// Solo salen quienes pueden recibirlo y aún no lo tienen. El plazo para aceptar lo fija el servidor al asignar (parámetro de evaluación PR-14). Va dentro de un `app-form-modal`:
// el botón de enviar es del pie y apunta a este formulario por su id (`assign-form`); el modal lee `canSubmit`, `saving` y `dirty`.
@Component({
  selector: 'app-assign-people-form',
  imports: [TranslatePipe, DataTable, TableCell, TableToolbar, TableFilter, PersonCell, StatusIndicator, EmptyState],
  templateUrl: './assign-people-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignPeopleForm implements OnInit {
  private readonly team = inject(TeamService);
  private readonly api = inject(DocumentService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly maxAssignees = MAX_ASSIGNEES;

  readonly documentId = input.required<string>();
  /** Quién ya lo tiene asignado: no se vuelve a ofrecer. */
  readonly assignedUserIds = input<readonly string[]>([]);
  /** Se asignó: cuántas personas son nuevas. */
  readonly assigned = output<number>();

  readonly stage = signal<Stage>('loading');
  private readonly people = signal<TeamMember[]>([]);
  readonly roleFilter = signal<TeamRole | ''>('');
  readonly selected = signal<ReadonlySet<string | number>>(new Set());
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  /** Quienes pueden recibirlo ahora: con cuenta vigente, de un rol que acepta y que aún no lo tienen. */
  readonly candidates = computed(() => {
    const already = new Set(this.assignedUserIds());
    return this.people().filter((p) => (p.status === 'active' || p.status === 'pending') && ASSIGNABLE_ROLES.includes(p.role) && !already.has(p.id));
  });
  readonly list = new ClientList<TeamMember>(this.candidates, (p, q) => (!this.roleFilter() || p.role === this.roleFilter()) && includesText(q, p.name, p.last_name, p.email));
  readonly hasFilters = computed(() => this.list.searching() || !!this.roleFilter());
  readonly roleOptions: TableFilterOption[] = ASSIGNABLE_ROLES.map((r) => ({ value: r, labelKey: 'TEAM.ROLE.' + r.toUpperCase() }));

  readonly count = computed(() => this.selected().size);
  readonly overLimit = computed(() => this.count() > MAX_ASSIGNEES);
  readonly dirty = computed(() => this.count() > 0);
  readonly canSubmit = computed(() => this.count() > 0 && !this.overLimit());

  readonly columns: TableColumn<TeamMember>[] = [
    { key: 'person', headerKey: 'DOCUMENTS.ASSIGN.COLUMNS.PERSON', skeleton: 'person' },
    { key: 'role', headerKey: 'DOCUMENTS.ASSIGN.COLUMNS.ROLE', skeleton: 'badge' },
    { key: 'status', headerKey: 'DOCUMENTS.ASSIGN.COLUMNS.STATUS', skeleton: 'badge' },
  ];
  readonly rowKey = (m: TeamMember): string => m.id;
  readonly rowLabel = (m: TeamMember): string => this.personName(m);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    this.team.listAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (all) => {
        this.people.set(all);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  personName(p: { email: string; name: string | null; last_name: string | null }): string {
    return [p.name, p.last_name].filter(Boolean).join(' ') || p.email;
  }

  setRole(value: string): void {
    this.roleFilter.set(ASSIGNABLE_ROLES.find((r) => r === value) ?? '');
    this.list.restart();
  }

  clearFilters(): void {
    this.roleFilter.set('');
    this.list.reset();
  }

  setSelected(next: Set<string | number>): void {
    this.selected.set(next);
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  submit(): void {
    if (!this.canSubmit() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.assign(this.documentId(), [...this.selected()].map(String)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (added) => {
        this.saving.set(false);
        this.assigned.emit(added);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.error.set(this.explain(e));
      },
    });
  }

  /** Todo o nada: un error deja la selección como estaba. `message` ya viene traducido por el backend; el 409 de personas que ya no pueden recibirlo dice cuántas. */
  private explain(e: unknown): string {
    const code = apiErrorCode(e);
    if (code === 'ASSIGNEE_NOT_ELIGIBLE') {
      const ids = apiErrorData(e)['user_ids'];
      return this.translate.instant('DOCUMENTS.ASSIGN.ERROR.NOT_ELIGIBLE', { count: Array.isArray(ids) ? ids.length : 1 });
    }
    if (code === 'DOCUMENT_NOT_PUBLISHED') return this.translate.instant('DOCUMENTS.ASSIGN.ERROR.NOT_PUBLISHED');
    return apiErrorMessage(e, this.translate.instant('DOCUMENTS.ASSIGN.ERROR.GENERIC'));
  }
}
