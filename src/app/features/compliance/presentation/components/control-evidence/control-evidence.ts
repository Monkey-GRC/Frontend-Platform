import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { formatBytes } from '@shared/domain/utils/file-validation';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { Tag } from '@shared/presentation/components/tag/tag';
import { FileUpload } from '@shared/presentation/components/file-upload/file-upload';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Badge } from '@shared/presentation/components/badge/badge';
import { ControlEvidence as EvidenceSummary } from '@features/compliance/domain/models/control.models';
import { EVIDENCE_FILE_ACCEPT, EVIDENCE_MAX_BYTES, EvidencePerson, EvidenceRequirement, EvidenceSubmission, canPreviewEvidence, evidenceStateTone, suggestedEvidence } from '@features/compliance/domain/models/evidence.models';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { EvidenceService } from '@features/compliance/domain/services/evidence.service';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { Busy } from '@shared/presentation/directives/busy';
import { BusyFields } from '@shared/presentation/directives/busy-fields';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';

// 'full' = las evidencias del contrato; 'summary' = el resumen que trae el detalle del control, porque el endpoint de evidencias aún no existe en el backend.
type Stage = 'loading' | 'full' | 'summary' | 'error';

/** Solo http(s): nada de `javascript:` ni `data:` entra al visor, venga de donde venga el enlace. */
function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** La clave de la subida de una prueba: a diferencia de una evidencia requerida, la prueba tiene un solo lugar donde subir (el servidor lo crea en la primera entrega). */
const TEST_KEY = '__test__';

// La evidencia de UN control, donde el control la pide (D80). Tiene tres formas:
//  · sin más: cada evidencia requerida del control con su responsable y sus entregas, y subir el archivo ahí mismo;
//  · `testId` (D88): la evidencia de UNA prueba documental en este control — sus entregas y un botón para subir. La persona lee lo que la prueba pide y sube su documento;
//    el administrador de la empresa lo valida después. La primera subida crea el lugar de esa prueba, así que no hay nada que preparar antes;
//  · `suggested`: los documentos que el catálogo sugiere para el control sin decir a qué prueba sirven. Solo una guía: no cuentan para ninguna prueba.
//  · `testId` en una prueba manual que NO es documental (D85): los requerimientos de todos los controles del servicio que llevan la prueba, cada uno con su control, y el aviso de a cuáles más aplica.
// En cualquier forma, un PDF o una imagen entregados se pueden VER en un visor (MD-178); DOCX y XLSX solo se descargan.
// Si el backend aún no tiene el endpoint (MD-126), muestra el resumen del detalle sin la subida, y se enciende solo cuando exista.
@Component({
  selector: 'app-control-evidence',
  imports: [Badge, TranslatePipe, FileUpload, NgTemplateOutlet, FormModal, StatusIndicator, DataTable, TableCell, Tag, Skeleton, SkeletonRegion, Busy, BusyFields],
  templateUrl: './control-evidence.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Bajo una prueba, el bloque ocupa el alto de la tarjeta (MD-499).
  host: { '[class]': "embedded() ? 'flex flex-1 flex-col' : 'block'" },
})
export class ControlEvidence {
  private readonly api = inject(EvidenceService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly view = inject(ComplianceViewService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly labels = inject(EnumLabelService);
  protected readonly tone = evidenceStateTone;
  protected readonly TEST_KEY = TEST_KEY;

  readonly controlId = input.required<string>();
  /** El resumen del detalle del control: lo que se muestra mientras no exista el endpoint de evidencias. */
  // Cada requisito es una fila de la lista compacta (la tabla única en su variante para paneles): una sola columna con todo lo suyo.
  readonly summaryColumns: TableColumn<EvidenceSummary>[] = [{ key: 'item', headerKey: 'COMPLIANCE.EVIDENCE.REQUIRED_TITLE' }];
  readonly itemColumns: TableColumn<EvidenceRequirement>[] = [{ key: 'item', headerKey: 'COMPLIANCE.EVIDENCE.REQUIRED_TITLE' }];
  readonly summaryKey = (e: EvidenceSummary) => e.requirement_id;
  readonly requirementKey = (r: EvidenceRequirement) => r.id;

  readonly summary = input<EvidenceSummary[]>([]);
  /** ¿Puede este rol subir? Suben el administrador de la empresa, el responsable y el delegado (solo de lo asignado, D102). */
  readonly canUpload = input(false);
  /** Si viene, solo las evidencias requeridas de esa dimensión (las de una prueba manual); el resumen del detalle no trae dimensión y se muestra completo. */
  readonly dimension = input<string | null>(null);
  /** Dentro del bloque de pruebas: sin título propio, porque ya está bajo la prueba que lo pide. */
  readonly embedded = input(false);
  /** D88 · La prueba documental bajo la que se pinta: solo se muestra lo que se entregó PARA ELLA en este control. */
  readonly testId = input<string | null>(null);
  /** MD-499 · La prueba se cumple con evidencia solo mientras no hay integración conectada. */
  readonly fallback = input(false);
  /** Solo los documentos que el catálogo sugiere para el control (sin prueba asignada). */
  readonly suggested = input(false);
  // Se subió algo: el control cambió de estado (la evidencia alimenta sus pruebas documentales).
  readonly changed = output<void>();

  readonly accept = EVIDENCE_FILE_ACCEPT;
  readonly maxBytes = EVIDENCE_MAX_BYTES;

  readonly stage = signal<Stage>('loading');
  readonly items = signal<EvidenceRequirement[]>([]);
  /** D85 · Los otros controles del servicio a los que también aplica esta prueba (solo cuando se pinta bajo una prueba). */
  readonly sharedWith = signal<{ id: string; code: string }[]>([]);
  readonly sharedCodes = computed(() => this.sharedWith().map((c) => c.code).join(', '));
  /** Una prueba documental (D88) tiene un solo lugar donde subir; las demás pruebas manuales, un requerimiento por control. */
  readonly documentary = computed(() => !!this.testId());
  readonly visible = computed(() => {
    const dimension = this.dimension();
    const testId = this.testId();
    // Bajo una prueba el servidor ya manda solo lo de ella; en la documental se conserva además el filtro por prueba (D88), por si llega algo de otra.
    if (dimension && testId) return this.items().filter((r) => r.dimension === dimension && (!this.documentary() || r.test?.id === testId));
    return dimension ? this.items().filter((r) => r.dimension === dimension) : this.items();
  });
  /** Todo lo entregado para la prueba, la entrega más reciente primero. */
  readonly deliveries = computed(() => this.visible().flatMap((r) => r.submissions).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at) || b.version - a.version));
  /** Las entregas anteriores a la última, que se despliegan aparte. */
  readonly olderDeliveries = computed(() => this.deliveries().slice(1));
  readonly suggestions = computed(() => suggestedEvidence(this.items(), this.dimension() ?? 'policy'));

  // Una subida abierta a la vez: sobre qué requerimiento (o la prueba), con qué archivo.
  readonly uploadingFor = signal<string | null>(null);
  readonly file = signal<File | null>(null);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly expanded = signal<ReadonlySet<string>>(new Set());

  // El visor: qué entrega se mira, su enlace temporal (en texto para las imágenes, como recurso de confianza para el iframe del PDF) y en qué punto está.
  readonly previewOf = signal<EvidenceSubmission | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly previewSafeUrl = signal<SafeResourceUrl | null>(null);
  readonly previewLoading = signal(false);
  readonly previewFailed = signal(false);
  private previewSeq = 0;

  // Para ignorar la respuesta de una carga vieja que llega después de una más nueva (cambio de control, de prueba o de vista).
  private requestSeq = 0;

  constructor() {
    effect(() => {
      this.controlId();
      this.testId();
      this.view.viewParam();
      untracked(() => this.load());
    });
  }

  load(): void {
    const seq = ++this.requestSeq;
    const testId = this.testId();
    this.stage.set('loading');
    // Bajo una prueba se pide la evidencia de ESA prueba: trae también los otros controles a los que aplica (D85). Sin prueba, la del control.
    const request = testId
      ? this.api.listForTest(this.controlId(), testId, this.view.viewParam())
      : this.api.list(this.controlId(), this.view.viewParam()).pipe(map((items) => ({ items, shared_with: [] as { id: string; code: string }[] })));
    request.subscribe({
      next: (result) => {
        if (seq !== this.requestSeq) return;
        this.items.set(result.items);
        this.sharedWith.set(result.shared_with);
        this.stage.set('full');
      },
      // 404 = el endpoint aún no existe (el control sí existe: lo estamos mostrando). Cualquier otro fallo es un error real.
      error: (e: unknown) => {
        if (seq === this.requestSeq) this.stage.set(e instanceof HttpErrorResponse && e.status === 404 ? 'summary' : 'error');
      },
    });
  }

  // ── Ver la evidencia en pantalla (MD-178) ──

  /** Solo PDF, PNG y JPG se ven en pantalla; DOCX y XLSX se bajan. */
  canPreview(submission: EvidenceSubmission): boolean {
    return canPreviewEvidence(submission.file_type);
  }

  openPreview(submission: EvidenceSubmission): void {
    this.reset();
    this.previewOf.set(submission);
    this.fetchPreview(submission);
  }

  /** El enlace dura 5 minutos: si caducó mientras se miraba, se pide otro sin cerrar el visor. */
  refreshPreview(): void {
    const submission = this.previewOf();
    if (submission) this.fetchPreview(submission);
  }

  closePreview(): void {
    this.previewSeq++;
    this.previewOf.set(null);
    this.previewUrl.set(null);
    this.previewSafeUrl.set(null);
    this.previewFailed.set(false);
    this.previewLoading.set(false);
  }

  private fetchPreview(submission: EvidenceSubmission): void {
    const seq = ++this.previewSeq;
    this.previewUrl.set(null);
    this.previewSafeUrl.set(null);
    this.previewFailed.set(false);
    this.previewLoading.set(true);
    this.api.download(submission.id, 'inline').subscribe({
      next: (link) => {
        if (seq !== this.previewSeq) return;
        this.previewLoading.set(false);
        if (!isHttpUrl(link.url)) return this.previewFailed.set(true);
        this.previewUrl.set(link.url);
        // El enlace lo firmó nuestro servidor para este archivo y ya se comprobó que es http(s): no puede ser `javascript:` ni `data:`. El visor de PDF lo necesita como recurso del iframe.
        this.previewSafeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(link.url));
      },
      error: (e: unknown) => {
        if (seq !== this.previewSeq) return;
        this.previewLoading.set(false);
        // Un tipo que no se puede ver (422 disposition.not_supported) se baja en vez de verse.
        if (e instanceof HttpErrorResponse && e.status === 422 && apiFieldErrors(e).some((f) => f.code === 'disposition.not_supported')) {
          this.closePreview();
          this.download(submission);
          return;
        }
        this.previewFailed.set(true);
      },
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
    if (this.sending()) return;
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
        this.toast.showSuccess(this.translate.instant('COMPLIANCE.EVIDENCE.UPLOADED'));
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
    this.api.download(submission.id, 'attachment').subscribe({
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
    return formatLocalDate(iso, this.language.current());
  }

  private reset(): void {
    this.error.set(null);
  }
}
