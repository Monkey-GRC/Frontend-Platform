import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { formatBytes } from '@shared/domain/utils/file-validation';
import { FileUpload } from '@shared/presentation/components/file-upload/file-upload';
import { ControlEvidence as EvidenceSummary } from '../../../domain/models/control.models';
import { EVIDENCE_FILE_ACCEPT, EVIDENCE_MAX_BYTES, EvidencePerson, EvidenceRequirement, EvidenceSubmission, evidenceForTest, suggestedEvidence } from '../../../domain/models/evidence.models';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';
import { EnumLabelService } from '../../../domain/services/enum-label.service';
import { EvidenceService } from '../../../domain/services/evidence.service';

// 'full' = las evidencias del contrato; 'summary' = el resumen que trae el detalle del control, porque el endpoint de evidencias aún no existe en el backend.
type Stage = 'loading' | 'full' | 'summary' | 'error';

/** La clave de la subida de una prueba: a diferencia de una evidencia requerida, la prueba tiene un solo lugar donde subir (el servidor lo crea en la primera entrega). */
const TEST_KEY = '__test__';

// La evidencia de UN control, donde el control la pide (D80). Tiene tres formas:
//  · sin más: cada evidencia requerida del control con su responsable y sus entregas, y subir el archivo ahí mismo;
//  · `testId` (D88): la evidencia de UNA prueba documental en este control — sus entregas y un botón para subir. La persona lee lo que la prueba pide y sube su documento;
//    el consultor lo revisa después. La primera subida crea el lugar de esa prueba, así que no hay nada que preparar antes;
//  · `suggested`: los documentos que el catálogo sugiere para el control sin decir a qué prueba sirven. Solo una guía: no cuentan para ninguna prueba.
// Si el backend aún no tiene el endpoint (MD-126), muestra el resumen del detalle sin la subida, y se enciende solo cuando exista.
@Component({
  selector: 'app-control-evidence',
  imports: [TranslatePipe, FileUpload, NgTemplateOutlet],
  templateUrl: './control-evidence.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlEvidence {
  private readonly api = inject(EvidenceService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);
  protected readonly TEST_KEY = TEST_KEY;

  readonly controlId = input.required<string>();
  /** El resumen del detalle del control: lo que se muestra mientras no exista el endpoint de evidencias. */
  readonly summary = input<EvidenceSummary[]>([]);
  /** ¿Puede este rol subir? Los que suben son el administrador de la empresa y el funcional (solo de lo asignado). */
  readonly canUpload = input(false);
  /** Si viene, solo las evidencias requeridas de esa dimensión (las de una prueba manual); el resumen del detalle no trae dimensión y se muestra completo. */
  readonly dimension = input<string | null>(null);
  /** Dentro del bloque de pruebas: sin título propio, porque ya está bajo la prueba que lo pide. */
  readonly embedded = input(false);
  /** D88 · La prueba documental bajo la que se pinta: solo se muestra lo que se entregó PARA ELLA en este control. */
  readonly testId = input<string | null>(null);
  /** Solo los documentos que el catálogo sugiere para el control (sin prueba asignada). */
  readonly suggested = input(false);
  // Se subió algo: el control cambió de estado (la evidencia alimenta sus pruebas documentales).
  readonly changed = output<void>();

  readonly accept = EVIDENCE_FILE_ACCEPT;
  readonly maxBytes = EVIDENCE_MAX_BYTES;

  readonly stage = signal<Stage>('loading');
  readonly items = signal<EvidenceRequirement[]>([]);
  readonly visible = computed(() => {
    const dimension = this.dimension();
    const testId = this.testId();
    if (dimension && testId) return evidenceForTest(this.items(), dimension, testId);
    return dimension ? this.items().filter((r) => r.dimension === dimension) : this.items();
  });
  /** Todo lo entregado para la prueba, la entrega más reciente primero. */
  readonly deliveries = computed(() => this.visible().flatMap((r) => r.submissions).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at) || b.version - a.version));
  readonly suggestions = computed(() => suggestedEvidence(this.items(), this.dimension() ?? 'policy'));

  // Una subida abierta a la vez: sobre qué requerimiento (o la prueba), con qué archivo.
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

  /** ¿Ya hay algo entregado en este lugar? Decide si el botón dice «Subir evidencia» o «Subir una versión nueva». */
  hasDelivery(key: string): boolean {
    return key === TEST_KEY ? this.deliveries().length > 0 : (this.items().find((r) => r.id === key)?.submissions.length ?? 0) > 0;
  }

  startUpload(key: string): void {
    this.reset();
    this.file.set(null);
    this.uploadingFor.set(key);
  }

  cancelUpload(): void {
    this.reset();
    this.uploadingFor.set(null);
    this.file.set(null);
  }

  send(): void {
    const key = this.uploadingFor();
    const file = this.file();
    if (!key || !file) return;
    // Bajo una prueba, el archivo es de esa prueba en este control (D88); en una evidencia requerida, es una versión de ella.
    const testId = this.testId();
    const request = key === TEST_KEY && testId ? this.api.uploadForTest(this.controlId(), testId, file) : this.api.upload(key, file);
    this.sending.set(true);
    this.reset();
    request.subscribe({
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

  toggleVersions(key: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
