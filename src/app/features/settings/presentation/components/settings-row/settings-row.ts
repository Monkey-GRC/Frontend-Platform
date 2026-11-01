import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

// Una fila de una categoría: su título, una descripción y, a la derecha, lo que se proyecte (un estado, un valor). Con `link` toda la fila es un enlace y muestra el «>»;
// sin él, es solo informativa.
//   <app-settings-row title="Contraseña" description="…" link="/ajustes/seguridad/contrasena" />
//   <app-settings-row title="Aplicación de autenticación" description="…"><span>Obligatoria</span></app-settings-row>
@Component({
  selector: 'app-settings-row',
  imports: [NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // La línea que separa una fila de la anterior es un pseudo-elemento inset: arranca donde empieza el texto y termina a la misma distancia del borde derecho, sin tocar el borde de la tarjeta.
  host: {
    class:
      'relative block [&:not(:first-child)]:before:absolute [&:not(:first-child)]:before:inset-x-5 [&:not(:first-child)]:before:top-0 [&:not(:first-child)]:before:h-px [&:not(:first-child)]:before:bg-gray-100 dark:[&:not(:first-child)]:before:bg-gray-800',
  },
  template: `
    <ng-template #body>
      <div class="min-w-0 flex-1">
        <p class="text-base font-medium text-gray-900 dark:text-white">{{ title() }}</p>
        @if (description()) {
          <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ description() }}</p>
        }
      </div>
      <div class="flex shrink-0 items-center gap-2 text-base text-gray-600 dark:text-gray-300">
        <ng-content />
        @if (link()) {
          <span class="material-symbols-rounded text-[24px] text-gray-400" aria-hidden="true">chevron_right</span>
        }
      </div>
    </ng-template>

    @if (link(); as target) {
      <a [routerLink]="target" data-testid="settings-row-link"
        class="flex items-center gap-4 px-5 py-4 transition hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 dark:hover:bg-white/5 dark:focus-visible:bg-white/5">
        <ng-container [ngTemplateOutlet]="body" />
      </a>
    } @else {
      <div class="flex items-center gap-4 px-5 py-4" data-testid="settings-row-static">
        <ng-container [ngTemplateOutlet]="body" />
      </div>
    }
  `,
})
export class SettingsRow {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly link = input<string | null>(null);
}
