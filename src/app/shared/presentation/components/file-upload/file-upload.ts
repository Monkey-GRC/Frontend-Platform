import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FileProblem, FileRules, acceptedTypesLabel, formatBytes, validateFile } from '@shared/domain/utils/file-validation';

// Subida de un archivo: se arrastra o se elige, se valida el tipo y el tamaño ANTES de aceptarlo y, si no sirve, se dice por qué
// con un mensaje claro. No sube nada: solo entrega el archivo ya validado; quien la usa decide cuándo y adónde enviarlo.
//   <app-file-upload [accept]="['.pdf', '.docx']" [maxBytes]="25 * 1024 * 1024" [(file)]="evidence" labelKey="..." />
// Teclado: el campo es un <input type="file"> real (Tab, Enter y Espacio abren el selector); el error se anuncia a los lectores de pantalla.
@Component({
  selector: 'app-file-upload',
  imports: [TranslatePipe],
  templateUrl: './file-upload.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUpload {
  // Extensiones permitidas, con punto: ['.pdf', '.docx'].
  readonly accept = input.required<readonly string[]>();
  readonly maxBytes = input.required<number>();
  readonly labelKey = input<string | null>(null);
  readonly disabled = input(false);
  // Un error que viene de fuera (por ejemplo, el que devolvió el servidor al subirlo), ya traducido.
  readonly externalError = input<string | null>(null);
  readonly inputId = input('file-upload');

  // El archivo elegido (válido). `null` si no hay ninguno. Se puede enlazar con [(file)].
  readonly file = model<File | null>(null);
  // Avisa cuando se rechazó un archivo, con el motivo.
  readonly rejected = output<FileProblem>();

  protected readonly problem = signal<FileProblem | null>(null);
  protected readonly dragging = signal(false);

  protected readonly rules = computed<FileRules>(() => ({ accept: this.accept(), maxBytes: this.maxBytes() }));
  protected readonly acceptAttr = computed(() => this.accept().join(','));
  protected readonly typesLabel = computed(() => acceptedTypesLabel(this.accept()));
  protected readonly maxLabel = computed(() => formatBytes(this.maxBytes()));

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = input.files?.[0] ?? null;
    input.value = ''; // permite volver a elegir el mismo archivo después de quitarlo
    this.take(chosen);
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.disabled()) return;
    this.take(event.dataTransfer?.files?.[0] ?? null);
  }

  protected dragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) this.dragging.set(true);
  }

  protected remove(): void {
    this.file.set(null);
    this.problem.set(null);
  }

  protected size(file: File): string {
    return formatBytes(file.size);
  }

  private take(chosen: File | null): void {
    if (!chosen) return;
    const problem = validateFile(chosen, this.rules());
    this.problem.set(problem);
    if (problem) {
      this.rejected.emit(problem);
      return;
    }
    this.file.set(chosen);
  }
}
