import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

// El encabezado de una pantalla de Monkey: el bloque azul de la marca, compacto, con un título, un subtítulo opcional y, a la derecha, las acciones de la pantalla.
//   <app-page-header title="Mis servicios" subtitle="…" icon="inventory_2" backLink="/" backLabel="Inicio">
//     <button actions class="mk-hero-btn">…</button>
//   </app-page-header>
// Lo que lleve `actions` va a la derecha; lo que lleve `meta` queda bajo el título (etiquetas, el período…). Los botones del bloque usan `mk-hero-btn` (translúcido) o `mk-hero-btn-solid` (blanco).
@Component({
  selector: 'app-page-header',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="mk-hero px-5 py-3 md:px-6">
      <div class="relative z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div class="flex min-w-0 items-center gap-3">
          @if (backLink(); as link) {
            <a [routerLink]="link" [attr.aria-label]="backLabel()" [title]="backLabel()"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-inset ring-white/25 transition hover:bg-white/25">
              <span class="material-symbols-rounded text-[20px]" aria-hidden="true">arrow_back</span>
            </a>
          } @else if (icon(); as glyph) {
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/25">
              <span class="material-symbols-rounded text-[24px]" aria-hidden="true">{{ glyph }}</span>
            </span>
          }
          <div class="min-w-0">
            @if (eyebrow(); as e) {<p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{{ e }}</p>}
            <h1 class="truncate text-xl font-semibold tracking-tight">{{ title() }}</h1>
            @if (subtitle(); as s) {<p class="mt-0.5 text-sm text-white/80">{{ s }}</p>}
            <ng-content select="[meta]" />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2"><ng-content select="[actions]" /></div>
      </div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  /** Un texto pequeño en mayúsculas sobre el título. */
  readonly eyebrow = input<string | null>(null);
  readonly icon = input<string | null>(null);
  /** Si viene, a la izquierda va un botón redondo de «volver» a esa ruta (y no el ícono). */
  readonly backLink = input<string | readonly string[] | null>(null);
  readonly backLabel = input('');
}
