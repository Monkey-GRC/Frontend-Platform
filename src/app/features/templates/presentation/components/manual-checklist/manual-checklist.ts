import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ManualCheckService } from '@features/templates/domain/services/manual-check.service';
import {
  ManualCheckEvidenceWithUrl,
  ManualCheckItem,
  ManualCheckStatus,
} from '@features/templates/domain/models/template.models';

@Component({
  selector: 'app-manual-checklist',
  imports: [FormsModule],
  templateUrl: './manual-checklist.html',
  styleUrl: './manual-checklist.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualChecklist implements OnInit {
  @Input({ required: true }) controlId!: string;
  /**
   * 'manage' (Dashboard): evaluar — cambiar estado, notas, evidencia. No crea ni borra checks.
   * 'view' (Templates): estructura — crear/borrar checks. No evalúa ni sube evidencia (eso es remediación, vive en Dashboard).
   */
  @Input() mode: 'view' | 'manage' = 'manage';

  private readonly manualCheckService = inject(ManualCheckService);

  readonly items = signal<ManualCheckItem[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly expandedId = signal<string | null>(null);
  readonly evidenceByCheck = signal<Record<string, ManualCheckEvidenceWithUrl[]>>({});
  readonly evidenceLoadingId = signal<string | null>(null);
  readonly uploadingId = signal<string | null>(null);
  readonly storageUnavailable = signal(false);

  readonly creatingNew = signal(false);
  readonly savingNew = signal(false);
  newTitle = '';
  newDescription = '';
  newRemediation = '';

  readonly notesDraft = signal<Record<string, string>>({});

  readonly statusOptions: { value: ManualCheckStatus; label: string }[] = [
    { value: 'PENDING', label: 'Pendiente' },
    { value: 'PASSED', label: 'Cumple' },
    { value: 'FAILED', label: 'Falla' },
    { value: 'NOT_APPLICABLE', label: 'No aplica' },
  ];

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.manualCheckService.listByControl(this.controlId).subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('No se pudieron cargar los checks manuales.');
      },
    });
  }

  statusLabel(status: ManualCheckStatus): string {
    return this.statusOptions.find((o) => o.value === status)?.label ?? status;
  }

  statusClasses(status: ManualCheckStatus): string {
    switch (status) {
      case 'PASSED':
        return 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400';
      case 'FAILED':
        return 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400';
      case 'NOT_APPLICABLE':
        return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400';
    }
  }

  updateNotesDraft(itemId: string, value: string): void {
    this.notesDraft.update((current) => ({ ...current, [itemId]: value }));
  }

  toggle(item: ManualCheckItem): void {
    const isClosing = this.expandedId() === item.id;
    this.expandedId.set(isClosing ? null : item.id);
    if (!isClosing) {
      this.notesDraft.update((current) => ({ ...current, [item.id]: current[item.id] ?? item.notes ?? '' }));
      if (this.mode === 'manage') this.loadEvidence(item.id);
    }
  }

  private loadEvidence(manualCheckId: string): void {
    this.evidenceLoadingId.set(manualCheckId);
    this.manualCheckService.listEvidence(manualCheckId).subscribe({
      next: (evidence) => {
        this.evidenceByCheck.update((current) => ({ ...current, [manualCheckId]: evidence }));
        this.evidenceLoadingId.set(null);
      },
      error: () => {
        this.evidenceLoadingId.set(null);
      },
    });
  }

  startCreate(): void {
    this.creatingNew.set(true);
  }

  cancelCreate(): void {
    this.creatingNew.set(false);
    this.newTitle = '';
    this.newDescription = '';
    this.newRemediation = '';
  }

  confirmCreate(): void {
    const title = this.newTitle.trim();
    if (!title) return;
    this.savingNew.set(true);
    this.manualCheckService
      .create(this.controlId, {
        title,
        description: this.newDescription.trim() || undefined,
        remediation: this.newRemediation.trim() || undefined,
      })
      .subscribe({
        next: (item) => {
          this.items.update((current) => [...current, item]);
          this.savingNew.set(false);
          this.cancelCreate();
        },
        error: () => {
          this.savingNew.set(false);
          this.errorMessage.set('No se pudo crear el check manual.');
        },
      });
  }

  setStatus(item: ManualCheckItem, status: ManualCheckStatus): void {
    if (item.status === status) return;
    const notes = this.notesDraft()[item.id] ?? item.notes ?? undefined;
    this.manualCheckService.setStatus(item.id, { status, notes }).subscribe({
      next: (updated) => this.replaceItem(updated),
      error: () => this.errorMessage.set('No se pudo actualizar el estado del check.'),
    });
  }

  saveNotes(item: ManualCheckItem): void {
    const notes = this.notesDraft()[item.id] ?? '';
    this.manualCheckService.setStatus(item.id, { status: item.status, notes }).subscribe({
      next: (updated) => this.replaceItem(updated),
      error: () => this.errorMessage.set('No se pudieron guardar las observaciones.'),
    });
  }

  remove(item: ManualCheckItem): void {
    this.manualCheckService.remove(item.id).subscribe({
      next: () => {
        this.items.update((current) => current.filter((i) => i.id !== item.id));
        if (this.expandedId() === item.id) this.expandedId.set(null);
      },
      error: () => this.errorMessage.set('No se pudo eliminar el check manual.'),
    });
  }

  private replaceItem(updated: ManualCheckItem): void {
    this.items.update((current) => current.map((i) => (i.id === updated.id ? updated : i)));
  }

  onFileSelected(item: ManualCheckItem, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadingId.set(item.id);
    this.manualCheckService.uploadEvidence(item.id, file).subscribe({
      next: () => {
        this.uploadingId.set(null);
        this.loadEvidence(item.id);
      },
      error: (err: HttpErrorResponse) => {
        this.uploadingId.set(null);
        if (err.status === 503) {
          this.storageUnavailable.set(true);
          return;
        }
        this.errorMessage.set(err.error?.message ?? 'No se pudo subir el archivo de evidencia.');
      },
    });
  }

  removeEvidence(item: ManualCheckItem, evidenceId: string): void {
    this.manualCheckService.removeEvidence(item.id, evidenceId).subscribe({
      next: () => this.loadEvidence(item.id),
      error: () => this.errorMessage.set('No se pudo eliminar la evidencia.'),
    });
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
