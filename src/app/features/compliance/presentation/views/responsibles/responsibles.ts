import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Responsible } from '@shared/domain/models/risk.models';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { ResponsibleService } from '@features/compliance/domain/services/responsible.service';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { Field } from '@shared/presentation/components/field/field';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { targetValue } from '@shared/presentation/utils/event-target';
import { Select } from '@shared/presentation/components/select/select';

type Stage = 'loading' | 'error' | 'ready';

// Los cargos responsables de la organización (MD-135): COO, TI, Cumplimiento, Proceso, CISO y propietarios de activo, cada uno con el nombre de la persona. Son de la
// organización, no de un servicio, por eso tienen su propia pantalla y no una pestaña de Cumplimiento. A un cargo se le asignan tratamientos de riesgo y evidencias.
// El administrador de la empresa crea, cambia la persona y quita; el resto de roles solo lee. Un cargo del que algo depende no se puede quitar (409).
@Component({
  selector: 'app-responsibles',
  imports: [PageHeader, TranslatePipe, ConfirmDialog, LoadingSpinner, DataTable, TableCell, EmptyState, Field, FormModal, StatusIndicator, Select],
  templateUrl: './responsibles.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResponsiblesView implements OnInit {
  protected readonly targetValue = targetValue;
  private readonly api = inject(ResponsibleService);
  private readonly translate = inject(TranslateService);
  readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  // Los tipos de cargo salen del backend (enum de Postgres `responsible_type`).
  readonly types = toSignal(inject(CatalogService).options('responsible_type'), { initialValue: [] });

  readonly stage = signal<Stage>('loading');
  readonly items = signal<Responsible[]>([]);
  readonly saving = signal(false);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  // Tabla: la columna de acciones solo existe para quien administra.
  readonly columns = computed<TableColumn<Responsible>[]>(() => [
    { key: 'type', headerKey: 'COMPLIANCE.RESPONSIBLES.TYPE' },
    { key: 'person', headerKey: 'COMPLIANCE.RESPONSIBLES.PERSON' },
    { key: 'status', headerKey: 'COMPLIANCE.RESPONSIBLES.COL_STATUS' },
    ...(this.view.canManage() ? [{ key: 'actions', headerKey: 'COMPLIANCE.RESPONSIBLES.COL_ACTIONS', align: 'right' as const, srOnlyHeader: true }] : []),
  ]);
  readonly rowKey = (r: Responsible): string => r.id;

  // Alta: el formulario vive en un drawer que abre «Agregar responsable».
  readonly addOpen = signal(false);
  readonly newType = signal('');
  readonly newName = signal('');
  readonly canAdd = computed(() => !!this.newType() && !!this.newName().trim() && !this.saving());

  // Cambio de persona y baja
  readonly editing = signal<string | null>(null);
  readonly editName = signal('');
  readonly removing = signal<Responsible | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    this.api.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  openAdd(): void {
    this.reset();
    this.addOpen.set(true);
  }

  closeAdd(): void {
    if (this.saving()) return;
    this.addOpen.set(false);
    this.newType.set('');
    this.newName.set('');
  }

  add(): void {
    if (!this.canAdd()) return;
    this.run(this.api.create(this.newType(), this.newName().trim()), 'COMPLIANCE.RESPONSIBLES.CREATED', () => {
      this.addOpen.set(false);
      this.newType.set('');
      this.newName.set('');
    });
  }

  startEdit(r: Responsible): void {
    this.reset();
    this.editing.set(r.id);
    this.editName.set(r.person_name ?? '');
  }

  cancelEdit(): void {
    this.editing.set(null);
  }

  saveEdit(): void {
    const id = this.editing();
    const name = this.editName().trim();
    if (!id || !name) return;
    this.run(this.api.rename(id, name), 'COMPLIANCE.RESPONSIBLES.UPDATED', () => this.editing.set(null));
  }

  askRemove(r: Responsible): void {
    this.reset();
    this.removing.set(r);
  }

  confirmRemove(): void {
    const r = this.removing();
    if (!r) return;
    this.run(this.api.remove(r.id), 'COMPLIANCE.RESPONSIBLES.REMOVED', () => this.removing.set(null), () => this.removing.set(null));
  }

  private run(call: Observable<unknown>, noticeKey: string, done: () => void, failed?: () => void): void {
    this.saving.set(true);
    this.reset();
    call.subscribe({
      next: () => {
        this.saving.set(false);
        done();
        this.notice.set(this.translate.instant(noticeKey));
        this.load();
      },
      // `message` ya viene traducido por el backend (409: ya existe, en uso, organización sin declarar; 422: campos).
      error: (e) => {
        this.saving.set(false);
        failed?.();
        this.error.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.RESPONSIBLES.SAVE_ERROR')));
      },
    });
  }

  private reset(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
