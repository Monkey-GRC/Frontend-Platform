import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { environment } from '@environments/environment';
import { modifierKeyLabel } from '@shared/domain/utils/keyboard';

// El «?» del encabezado: los atajos de teclado de la app y, si el entorno trae una dirección de soporte (`supportUrl`: una URL o un `mailto:`), cómo contactarlo.
// Sin esa dirección no se muestra el contacto: no se inventa ninguna. Se cierra al elegir algo, al hacer clic fuera y con Escape.
@Component({
  selector: 'app-help-menu',
  imports: [TranslatePipe],
  templateUrl: './help-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocumentClick($event)', '(document:keydown.escape)': 'close()' },
})
export class HelpMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly open = signal(false);
  readonly modifier = modifierKeyLabel();
  readonly supportUrl = ((environment as { supportUrl?: string }).supportUrl ?? '').trim() || null;
  // Una página web se abre en otra pestaña; un `mailto:` abre el programa de correo.
  readonly supportOpensTab = !!this.supportUrl && /^https?:/i.test(this.supportUrl);

  toggle(): void {
    this.open.update((value) => !value);
  }

  close(): void {
    this.open.set(false);
  }

  onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }
}
