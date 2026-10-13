import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

let nextId = 0;

// Panel que se desliza desde la derecha para ver o editar un elemento sin salir de la lista (como en AWS). Existe mientras esté
// en pantalla: se pone dentro de un `@if` y se quita cuando emite `closed`.
//   @if (selected(); as item) {
//     <app-side-panel titleKey="..." [titleParams]="{ name: item.name }" (closed)="selected.set(null)">
//       ...contenido...
//       <button panelFooter ...>Guardar</button>      ← lo que lleve `panelFooter` queda fijo abajo
//     </app-side-panel>
//   }
// Teclado: el foco queda dentro del panel, Esc y hacer clic fuera lo cierran, y al cerrar el foco vuelve a donde estaba.
@Component({
  selector: 'app-side-panel',
  imports: [A11yModule, TranslatePipe],
  templateUrl: './side-panel.html',
  styles: [
    `
      @keyframes mk-panel-in {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      .mk-panel { animation: mk-panel-in 180ms ease-out; }
      @media (prefers-reduced-motion: reduce) {
        .mk-panel { animation: none; }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class SidePanel {
  readonly titleKey = input.required<string>();
  readonly titleParams = input<Record<string, unknown>>({});
  readonly subtitleKey = input<string | null>(null);
  readonly subtitleParams = input<Record<string, unknown>>({});
  readonly size = input<'md' | 'lg'>('md');

  readonly closed = output<void>();

  protected readonly titleId = `panel-title-${nextId++}`;
}
