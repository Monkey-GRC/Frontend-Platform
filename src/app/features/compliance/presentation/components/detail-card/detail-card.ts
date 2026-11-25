import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

let nextId = 0;

// Una sección del detalle de un control, un riesgo o una causa (dentro de `app-detail-modal`, MD-499): el título con una línea fina debajo y, a la derecha,
// sus acciones (p. ej. «Editar», proyectadas con el atributo `actions`). Sin caja ni sombra: el modal ya es el contenedor (un solo nivel, README §1) y todas las
// secciones usan el mismo encabezado para que el detalle se lea como una sola estructura. `count` (opcional) dice cuántos elementos lista la sección.
@Component({
  selector: 'app-detail-card',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section [attr.aria-labelledby]="titleId">
      <div class="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line pb-2">
        <h3 [id]="titleId" class="text-base font-semibold text-ink">
          {{ titleKey() | translate }}@if (count() !== null) {<span class="ml-1.5 font-normal tabular-nums text-ink-faint" data-section-count>{{ count() }}</span>}
        </h3>
        <div class="flex items-center gap-3 empty:hidden"><ng-content select="[actions]" /></div>
      </div>
      <div class="pt-3"><ng-content /></div>
    </section>
  `,
})
export class DetailCard {
  readonly titleKey = input.required<string>();
  /** Cuántos elementos lista la sección; `null` no muestra nada. */
  readonly count = input<number | null>(null);

  protected readonly titleId = `detail-section-${nextId++}`;
}
