import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FileProblem, FileRules, acceptedTypesLabel, formatBytes, validateFile } from '@shared/domain/utils/file-validation';
import { fileKind } from '@features/compliance/domain/utils/file-kind';
import { ProgressLine } from '@shared/presentation/components/progress-line/progress-line';
import { LoadProgress } from '@shared/presentation/components/skeleton/skeleton';

export type DropzoneMessageTone = 'info' | 'error' | 'success';

// Zona de carga de la evidencia (MD-505): elegir → vista previa → «Subir».
//  1. Se hace clic (o Enter / Espacio) o se suelta un archivo; se valida el tipo y el tamaño ANTES de la vista previa (un archivo que no sirve no llega a ella).
//  2. Vista previa: nombre, tipo y tamaño, la miniatura si es una imagen y el icono de su tipo si no; «Subir», «Cambiar archivo» y la X para quitarlo.
//  3. «Subir» avisa con `upload` y quien la usa la pone `busy`: avance real con su porcentaje (`percent`, de los eventos de subida); sin total, o con los bytes ya enviados y el
//     servidor aún guardando, la barra indeterminada animada. «Cancelar» avisa con `canceled`.
//  4. El final lo dice quien la usa con `message`: `success` limpia la vista previa y queda el aviso de éxito; `error` deja la vista previa con el mensaje y «Reintentar».
//   <app-evidence-dropzone [accept]="accept" [maxBytes]="max" [busy]="sending()" [percent]="pct()" [message]="note()" [messageTone]="tone()" (upload)="send($event)" (canceled)="abort()" (chosen)="clearNote()" />
@Component({
  selector: 'app-evidence-dropzone',
  imports: [TranslatePipe, ProgressLine, LoadProgress],
  templateUrl: './evidence-dropzone.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvidenceDropzone {
  readonly accept = input.required<readonly string[]>();
  readonly maxBytes = input.required<number>();
  readonly inputId = input('evidence-file');
  /** Ya hay algo entregado: el texto invita a reemplazarlo. */
  readonly replace = input(false);
  readonly disabled = input(false);
  /** Por qué está deshabilitada (clave i18n); sustituye a la invitación. */
  readonly disabledKey = input<string | null>(null);
  /** Subiendo: la vista previa muestra el avance y «Cancelar». */
  readonly busy = input(false);
  /** 0-100, o `null` si no se sabe el total (barra indeterminada). */
  readonly percent = input<number | null>(null);
  /** Un mensaje que viene de fuera (éxito, error del servidor o subida cancelada), ya traducido. */
  readonly message = input<string | null>(null);
  /** `success` al terminar; `info` para lo que decidió la persona (cancelar); `error` para un fallo real. */
  readonly messageTone = input<DropzoneMessageTone>('error');

  /** «Subir» (o «Reintentar») con el archivo de la vista previa. */
  readonly upload = output<File>();
  readonly canceled = output<void>();
  /** Cambió el archivo elegido (o se quitó): quien la usa borra el mensaje anterior. */
  readonly chosen = output<File | null>();

  protected readonly problem = signal<FileProblem | null>(null);
  protected readonly dragging = signal(false);
  /** El archivo de la vista previa (ya validado). */
  protected readonly file = signal<File | null>(null);
  /** La miniatura de una imagen (`blob:`), que se libera al cambiar de archivo o al destruir la zona. */
  protected readonly thumbUrl = signal<string | null>(null);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly rules = computed<FileRules>(() => ({ accept: this.accept(), maxBytes: this.maxBytes() }));
  protected readonly acceptAttr = computed(() => this.accept().join(','));
  protected readonly typesLabel = computed(() => acceptedTypesLabel(this.accept()));
  protected readonly maxLabel = computed(() => formatBytes(this.maxBytes()));
  protected readonly typesId = computed(() => `${this.inputId()}-types`);
  protected readonly kind = computed(() => {
    const f = this.file();
    return f ? fileKind(f) : null;
  });
  protected readonly sizeLabel = computed(() => {
    const f = this.file();
    return f ? formatBytes(f.size) : '';
  });
  /** Los bytes ya salieron (100 %) pero el servidor aún no respondió: se está guardando. */
  protected readonly processing = computed(() => this.busy() && this.percent() !== null && (this.percent() ?? 0) >= 100);
  /** Sin total conocido o guardando: la barra indeterminada (animada); si no, la determinada con su porcentaje. */
  protected readonly indeterminate = computed(() => this.busy() && (this.percent() === null || this.processing()));
  protected readonly failed = computed(() => !this.busy() && !!this.message() && this.messageTone() === 'error');

  constructor() {
    // Subida terminada: la vista previa se cierra y queda el aviso de éxito con la zona lista para otro archivo.
    effect(() => {
      if (this.messageTone() === 'success' && this.message()) untracked(() => this.setFile(null));
    });
    inject(DestroyRef).onDestroy(() => this.revokeThumb());
  }

  protected open(event?: Event): void {
    event?.preventDefault();
    if (this.disabled() || this.busy()) return;
    this.field()?.nativeElement.click();
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = input.files?.[0] ?? null;
    input.value = '';
    this.take(chosen);
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.disabled() || this.busy()) return;
    this.take(event.dataTransfer?.files?.[0] ?? null);
  }

  protected dragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled() && !this.busy()) this.dragging.set(true);
  }

  protected send(): void {
    const f = this.file();
    if (!f || this.busy() || this.disabled()) return;
    this.upload.emit(f);
  }

  protected remove(): void {
    if (this.busy()) return;
    this.problem.set(null);
    this.setFile(null);
    this.chosen.emit(null);
  }

  private take(chosen: File | null): void {
    if (!chosen) return;
    const problem = validateFile(chosen, this.rules());
    this.problem.set(problem);
    if (problem) return;
    this.setFile(chosen);
    this.chosen.emit(chosen);
  }

  private setFile(f: File | null): void {
    this.revokeThumb();
    this.file.set(f);
    if (f && fileKind(f).image && typeof URL.createObjectURL === 'function') this.thumbUrl.set(URL.createObjectURL(f));
  }

  private revokeThumb(): void {
    const url = this.thumbUrl();
    if (url) URL.revokeObjectURL(url);
    this.thumbUrl.set(null);
  }
}
