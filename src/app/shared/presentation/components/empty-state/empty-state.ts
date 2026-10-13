import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

// «Aún no hay nada aquí»: ícono, título, una frase que explica qué hacer y, si hace falta, la acción (se proyecta dentro:
// `<app-empty-state ...><a routerLink="...">Crear</a></app-empty-state>`). Los textos son claves de traducción.
@Component({
  selector: 'app-empty-state',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-600 dark:bg-gray-900">
      <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <span class="material-symbols-rounded text-3xl" aria-hidden="true">{{ icon() }}</span>
      </span>
      <h2 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{{ titleKey() | translate }}</h2>
      @if (descriptionKey(); as description) {
        <p class="mx-auto mt-1 max-w-sm text-sm text-gray-600 dark:text-gray-300">{{ description | translate }}</p>
      }
      <div class="mt-6 flex justify-center empty:hidden"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly titleKey = input.required<string>();
  readonly descriptionKey = input<string | null>(null);
}
