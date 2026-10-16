import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { formatBytes } from '@shared/domain/utils/file-validation';
import { FileUpload } from '@shared/presentation/components/file-upload/file-upload';
import { ControlEvidence as EvidenceSummary } from '../../../domain/models/control.models';
import { EVIDENCE_FILE_ACCEPT, EVIDENCE_MAX_BYTES, EvidencePerson, EvidenceRequirement, EvidenceSubmission } from '../../../domain/models/evidence.models';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';
import { EnumLabelService } from '../../../domain/services/enum-label.service';
import { EvidenceService } from '../../../domain/services/evidence.service';

// 'full' = las evidencias del contrato; 'summary' = el resumen que trae el detalle del control, porque el endpoint de evidencias aún no existe en el backend.
type Stage = 'loading' | 'full' | 'summary' | 'error';

// Las evidencias de UN control, donde el control las pide (D80): cada evidencia requerida con su responsable y sus entregas, y, si el rol puede, subir el archivo
// ahí mismo. Es el mismo trabajo que la pestaña «Evidencias» (MD-129), que reutilizará este componente para todos los controles.
// Si el backend aún no tiene el endpoint (MD-126), muestra el resumen del detalle sin la subida, y se enciende solo cuando exista.
@Component({
  selector: 'app-control-evidence',
  imports: [TranslatePipe, FileUpload],
  templateUrl: './control-evidence.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlEvidence {
  private readonly api = inject(EvidenceService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  readonly controlId = input.required<string>();
  /** El resumen del detalle del control: lo que se muestra mientras no exista el endpoint de evidencias. */
  readonly summary = input<EvidenceSummary[]>([]);
  /** ¿Puede este rol subir? Los que suben son el administrador de la empresa y el funcional (solo de lo asignado). */
  readonly canUpload = input(false);
  // Se subió algo: el control cambió de estado (la evidencia alimenta sus pruebas documentales).
  readonly changed = output<void>();

  readonly accept = EVIDENCE_FILE_ACCEPT;
  readonly maxBytes = EVIDENCE_MAX_BYTES;

  readonly stage = signal<Stage>('loading');
  readonly items = signal<EvidenceRequirement[]>([]);

  // Una subida abierta a la vez: sobre qué requerimiento, con qué archivo.
  readonly uploadingFor = signal<string | null>(null);
  readonly file = signal<File | null>(null);
  readonly sending = signal(false);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly expanded = signal<ReadonlySet<string>>(new Set());

  constructor() {
    effect(() => {
      this.controlId();
      this.view.viewParam();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.stage.set('loading');
    this.api.list(this.controlId(), this.view.viewParam()).subscribe({
      next: (items) => {
        this.items.set(items);
        this.stage.set('full');
      },
      // 404 = el endpoint aún no existe (el control sí existe: lo estamos mostrando). Cualquier otro fallo es un error real.
      error: (e: unknown) => this.stage.set(e instanceof HttpErrorResponse && e.status === 404 ? 'summary' : 'error'),
    });
  }

  startUpload(requirementId: string): void {
    this.reset();
    this.file.set(null);
    this.uploadingFor.set(requirementId);
  }

  cancelUpload(): void {
    this.reset();
    this.uploadingFor.set(null);
    this.file.set(null);
  }

  send(): void {
    const requirementId = this.uploadingFor();
    const file = this.file();
    if (!requirementId || !file) return;
    this.sending.set(true);
    this.reset();
    this.api.upload(requirementId, file).subscribe({
      next: () => {
        this.sending.set(false);
        this.uploadingFor.set(null);
        this.file.set(null);
        this.notice.set(this.translate.instant('COMPLIANCE.EVIDENCE.UPLOADED'));
        this.load();
        this.changed.emit();
      },
      // `message` ya viene traducido por el backend (413 tamaño, 415 tipo, 422 sin archivo, 503 almacenamiento).
      error: (e) => {
        this.sending.set(false);
        this.error.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.EVIDENCE.UPLOAD_ERROR')));
      },
    });
  }

  download(submission: EvidenceSubmission): void {
    this.reset();
    this.api.download(submission.id).subscribe({
      next: (link) => window.open(link.url, '_blank', 'noopener'),
      error: (e) => this.error.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.EVIDENCE.DOWNLOAD_ERROR'))),
    });
  }

  toggleVersions(requirementId: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(requirementId)) next.delete(requirementId);
      else next.add(requirementId);
      return next;
    });
  }

  fullName(p: EvidencePerson | null): string {
    return p ? [p.name, p.last_name].filter(Boolean).join(' ') : '';
  }

  size(bytes: number): string {
    return formatBytes(bytes);
  }

  date(iso: string): string {
    return new Intl.DateTimeFormat(this.language.current(), { dateStyle: 'medium' }).format(new Date(iso));
  }

  private reset(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
