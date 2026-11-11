import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// Una categoría de una sección de Ajustes: su título y, debajo, una tarjeta que reúne sus filas (`app-settings-row`) separadas por una línea fina e inset (la dibuja cada fila).
//   <app-settings-group [title]="'…' | translate"> <app-settings-row … /> </app-settings-group>
@Component({
  selector: 'app-settings-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section>
      <h2 class="mb-3 text-lg font-medium text-ink">{{ title() }}</h2>
      <div class="overflow-hidden rounded-card border border-line bg-surface">
        <ng-content />
      </div>
    </section>
  `,
})
export class SettingsGroup {
  readonly title = input.required<string>();
}
