import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { DatePicker } from '@shared/presentation/components/date-picker/date-picker';
import { Field } from '@shared/presentation/components/field/field';
import { FileUpload } from '@shared/presentation/components/file-upload/file-upload';
import { targetValue } from '@shared/presentation/utils/event-target';
import { DOCUMENT_FILE_TYPES, DocumentApprover, DocumentVersion, MAX_APPROVERS, MAX_DOCUMENT_BYTES } from '@features/documents/domain/models/document.models';
import { DocumentService } from '@features/documents/domain/services/document.service';
import { todayIso } from '@features/documents/domain/utils/document-status';

const MAX_NOTE = 500;
const MAX_TEXT = 150;

interface ApproverDraft {
  /** Una clave estable por fila: quitar la del medio no mueve lo escrito en las demás. */
  key: number;
  name: string;
  role: string;
}

// Publicar la versión vigente de un documento como aprobación importada (D133 punto 5, D152, MD-503): el administrador sube el archivo y declara quién lo aprobó fuera de Monkey y cuándo.
// Los aprobadores son texto (de 1 a 3): pueden no tener cuenta. La versión anterior queda archivada y quienes ya la tenían asignada deberán aceptar la nueva. Va dentro de un `app-form-modal`:
// el botón de enviar es del pie del modal y apunta a este formulario por su id (`publish-form`); el modal lee `canSubmit`, `saving` y `dirty`.
@Component({
  selector: 'app-publish-version-form',
  imports: [TranslatePipe, Field, FileUpload, DatePicker],
  templateUrl: './publish-version-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublishVersionForm {
  protected readonly targetValue = targetValue;
  protected readonly maxApprovers = MAX_APPROVERS;
  protected readonly maxNote = MAX_NOTE;
  protected readonly maxText = MAX_TEXT;
  protected readonly accept = DOCUMENT_FILE_TYPES;
  protected readonly maxBytes = MAX_DOCUMENT_BYTES;
  protected readonly today = todayIso();
  private readonly api = inject(DocumentService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private nextKey = 1;

  readonly documentId = input.required<string>();
  /** Cuántas personas tienen hoy asignado el documento: si hay alguna, se avisa que tendrán que aceptar la versión nueva. */
  readonly assignedCount = input(0);
  /** La versión se publicó. */
  readonly published = output<DocumentVersion>();

  readonly file = signal<File | null>(null);
  readonly approvedAt = signal('');
  readonly approvers = signal<ApproverDraft[]>([{ key: 0, name: '', role: '' }]);
  readonly note = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly dirty = computed(() => !!(this.file() || this.approvedAt() || this.note().trim() || this.approvers().some((a) => a.name.trim() || a.role.trim())));
  readonly approversValid = computed(() => this.approvers().every((a) => a.name.trim() && a.role.trim()));
  /** El día no puede ser futuro (el servidor responde `approved_at.future`). */
  readonly dateValid = computed(() => !!this.approvedAt() && this.approvedAt() <= this.today);
  readonly canSubmit = computed(() => !!this.file() && this.dateValid() && this.approversValid() && this.approvers().length >= 1);
  readonly canAddApprover = computed(() => this.approvers().length < MAX_APPROVERS);

  addApprover(): void {
    if (!this.canAddApprover()) return;
    this.approvers.update((list) => [...list, { key: this.nextKey++, name: '', role: '' }]);
  }

  removeApprover(key: number): void {
    this.approvers.update((list) => (list.length > 1 ? list.filter((a) => a.key !== key) : list));
  }

  setApprover(key: number, field: 'name' | 'role', value: string): void {
    this.approvers.update((list) => list.map((a) => (a.key === key ? { ...a, [field]: value } : a)));
  }

  submit(): void {
    const file = this.file();
    if (!file || !this.canSubmit() || this.saving()) return;
    const approvers: DocumentApprover[] = this.approvers().map((a) => ({ name: a.name.trim(), role_label: a.role.trim() }));
    this.saving.set(true);
    this.error.set(null);
    this.api.publishVersion(this.documentId(), { file, approved_at: this.approvedAt(), approvers, note: this.note() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (version) => {
        this.saving.set(false);
        this.published.emit(version);
      },
      // `message` ya viene traducido por el backend (413 tamaño, 415 tipo, 422 sin archivo o fecha futura, 409 documento externo).
      error: (e: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(e, this.translate.instant('DOCUMENTS.PUBLISH.ERROR')));
      },
    });
  }
}
