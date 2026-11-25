import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorCode, apiErrorMessage, apiFieldErrors } from '@core/domain/utils/api-error';
import { Card } from '@shared/presentation/components/card/card';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { PageHeader } from '@shared/presentation/components/page-header/page-header';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { Busy } from '@shared/presentation/directives/busy';
import { LocalDatePipe } from '@shared/presentation/pipes/local-date.pipe';
import { MyDocument } from '@features/documents/domain/models/document.models';
import { DocumentService } from '@features/documents/domain/services/document.service';
import { canReadInline, downloadFromUrl, isHttpUrl, myStatusTone } from '@features/documents/domain/utils/document-status';

type Stage = 'loading' | 'error' | 'missing' | 'ready';
/** El visor: pidiendo el enlace, leyendo en pantalla, solo para descargar (un DOCX) o sin poder abrirse. */
type Viewer = 'loading' | 'inline' | 'download' | 'error';

/** Un error de aceptar ya explicado: su texto (clave de traducción) y si lo que ayuda es volver a cargar el documento. */
interface AcceptProblem {
  messageKey: string | null;
  /** Lo que dijo el servidor, ya traducido, cuando no hay un texto propio para el código. */
  serverMessage: string | null;
  reload: boolean;
}

// Los códigos de error de aceptar (contracts/documentos.md → «Errores del módulo») con su texto propio: qué pasó y qué hacer.
const ACCEPT_ERRORS: Readonly<Record<string, { messageKey: string; reload: boolean }>> = {
  DOCUMENT_VERSION_NOT_CURRENT: { messageKey: 'DOCUMENTS.READER.ERROR.NOT_CURRENT', reload: true },
  DOCUMENT_ALREADY_ACCEPTED: { messageKey: 'DOCUMENTS.READER.ERROR.ALREADY_ACCEPTED', reload: true },
  DOCUMENT_ACCEPTANCE_NOT_REQUIRED: { messageKey: 'DOCUMENTS.READER.ERROR.NOT_REQUIRED', reload: true },
};

// El lector de un documento asignado (D152, MD-503): el archivo de la versión vigente en pantalla —PDF e imágenes, con el enlace firmado de 5 minutos; un DOCX solo se descarga— y, al lado,
// «Aceptar». Aceptar manda la versión que la persona vio (`version_id`): si el administrador publicó otra mientras leía, el servidor lo rechaza (409) y aquí se explica y se carga la nueva.
// No hace falta haber abierto el archivo para aceptar (D152). La aceptación queda con la fecha, la versión y la huella del archivo, y no se edita ni se borra (SEG-88).
@Component({
  selector: 'app-document-reader',
  imports: [TranslatePipe, RouterLink, PageHeader, Card, ConfirmDialog, EmptyState, Skeleton, SkeletonRegion, StatusIndicator, Tag, Busy, LocalDatePipe],
  templateUrl: './document-reader.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentReaderView {
  private readonly api = inject(DocumentService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });
  protected readonly myStatusTone = myStatusTone;

  readonly documentId = computed(() => this.params().get('id') ?? '');
  readonly stage = signal<Stage>('loading');
  readonly item = signal<MyDocument | null>(null);

  readonly viewer = signal<Viewer>('loading');
  readonly fileUrl = signal<string | null>(null);
  // El enlace lo firmó nuestro servidor para este archivo y ya se comprobó que es http(s): no puede ser `javascript:` ni `data:`. El visor de PDF lo necesita como recurso del iframe.
  readonly safeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.fileUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  readonly fileName = signal('');
  readonly fileType = signal('');

  readonly confirming = signal(false);
  readonly accepting = signal(false);
  readonly downloading = signal(false);
  readonly problem = signal<AcceptProblem | null>(null);
  readonly downloadFailed = signal(false);

  /** ¿Falta aceptar? Solo si el documento lo pide y la persona aún no aceptó la versión vigente. */
  readonly canAccept = computed(() => {
    const d = this.item();
    return !!d && d.requires_acceptance && d.status !== 'accepted';
  });
  readonly isImage = computed(() => this.fileType().startsWith('image/'));

  // Cada carga lleva su número: la respuesta de una anterior (otro documento, o «cargar la versión nueva») se descarta.
  private loadSeq = 0;
  private viewSeq = 0;

  constructor() {
    effect(() => {
      this.documentId();
      untracked(() => this.load());
    });
  }

  /** Pide lo asignado a la persona y busca este documento: no hay un detalle suelto, así que un enlace directo también funciona. */
  load(): void {
    const seq = ++this.loadSeq;
    this.stage.set('loading');
    this.problem.set(null);
    this.api.mine().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        if (seq !== this.loadSeq) return;
        const found = items.find((d) => d.document.id === this.documentId()) ?? null;
        this.item.set(found);
        this.stage.set(found ? 'ready' : 'missing');
        if (found) this.openFile();
      },
      error: () => seq === this.loadSeq && this.stage.set('error'),
    });
  }

  /** Pide el enlace para leer la versión en pantalla. Un DOCX (`422 disposition.not_inline`) pasa a ser solo descarga; el enlace dura 5 minutos y «Volver a abrir» pide otro. */
  openFile(): void {
    const d = this.item();
    if (!d) return;
    const seq = ++this.viewSeq;
    this.viewer.set('loading');
    this.fileUrl.set(null);
    this.api.fileLink(d.document.id, d.version.id, 'inline').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (link) => {
        if (seq !== this.viewSeq) return;
        this.fileName.set(link.file_name);
        this.fileType.set(link.file_type);
        if (!isHttpUrl(link.url) || !canReadInline(link.file_type)) {
          this.viewer.set(isHttpUrl(link.url) ? 'download' : 'error');
          return;
        }
        this.fileUrl.set(link.url);
        this.viewer.set('inline');
      },
      error: (e: unknown) => {
        if (seq !== this.viewSeq) return;
        this.viewer.set(e instanceof HttpErrorResponse && e.status === 422 && apiFieldErrors(e).some((f) => f.code === 'disposition.not_inline') ? 'download' : 'error');
      },
    });
  }

  /** Baja el archivo con un enlace nuevo. */
  download(): void {
    const d = this.item();
    if (!d || this.downloading()) return;
    this.downloading.set(true);
    this.downloadFailed.set(false);
    this.api.fileLink(d.document.id, d.version.id, 'attachment').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (link) => {
        this.downloading.set(false);
        if (isHttpUrl(link.url)) downloadFromUrl(link.url, link.file_name);
        else this.downloadFailed.set(true);
      },
      error: () => {
        this.downloading.set(false);
        this.downloadFailed.set(true);
      },
    });
  }

  ask(): void {
    this.problem.set(null);
    this.confirming.set(true);
  }

  /** Acepta la versión que se está viendo. Si ya no es la vigente, el servidor lo dice (409) y se ofrece cargar la nueva. */
  confirm(): void {
    const d = this.item();
    if (!d || this.accepting()) return;
    this.accepting.set(true);
    this.api.accept(d.document.id, d.version.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.accepting.set(false);
        this.confirming.set(false);
        this.toast.showSuccess(this.translate.instant('DOCUMENTS.READER.ACCEPTED_TOAST', { code: d.document.code, number: d.version.number }));
        this.refreshItem();
      },
      error: (e: unknown) => {
        this.accepting.set(false);
        this.confirming.set(false);
        this.problem.set(this.explain(e));
      },
    });
  }

  /** Vuelve a pedir lo asignado para mostrar el estado nuevo, sin tapar el archivo que se está leyendo. */
  private refreshItem(): void {
    this.api.mine().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        const found = items.find((d) => d.document.id === this.documentId());
        if (found) this.item.set(found);
      },
      error: () => undefined,
    });
  }

  private explain(e: unknown): AcceptProblem {
    const own = ACCEPT_ERRORS[apiErrorCode(e) ?? ''];
    if (own) return { messageKey: own.messageKey, serverMessage: null, reload: own.reload };
    if (e instanceof HttpErrorResponse && e.status === 403) return { messageKey: 'DOCUMENTS.READER.ERROR.NOT_ASSIGNED', serverMessage: null, reload: false };
    // `message` ya viene traducido por el backend.
    return { messageKey: null, serverMessage: apiErrorMessage(e, this.translate.instant('DOCUMENTS.READER.ERROR.GENERIC')), reload: false };
  }
}
