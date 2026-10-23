import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

// Una sección del detalle de un control: un ícono en un círculo azul, el título y, a la derecha, sus acciones y el chevron que la abre o la cierra. Todas las secciones
// del detalle usan este mismo encabezado para que se lea como una sola estructura. Las acciones (p. ej. «Editar») se proyectan con el atributo `actions`.
@Component({
  selector: 'app-detail-card',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40" [attr.aria-label]="titleKey() | translate">
      <div class="flex items-center gap-3 px-4 py-3.5">
        <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/30 dark:bg-primary/20">
          <span class="material-symbols-rounded text-[20px] leading-none" aria-hidden="true">{{ icon() }}</span>
        </span>
        <button type="button" class="min-w-0 flex-1 text-left" [attr.aria-expanded]="isOpen()" [disabled]="forceOpen()" (click)="toggle()">
          <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ titleKey() | translate }}</h4>
        </button>
        <ng-content select="[actions]" />
        <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
          [disabled]="forceOpen()" tabindex="-1" aria-hidden="true" (click)="toggle()">
          <span class="material-symbols-rounded text-[22px] leading-none transition-transform" [class.rotate-180]="isOpen()">expand_more</span>
        </button>
      </div>
      @if (isOpen()) {
        <div class="px-4 pb-4 pl-[4rem]"><ng-content /></div>
      }
    </section>
  `,
})
export class DetailCard {
  readonly titleKey = input.required<string>();
  /** Nombre del ícono de Material Symbols. */
  readonly icon = input.required<string>();
  /** Si arranca abierta. */
  readonly startOpen = input(true);
  /** Mantiene la sección abierta (p. ej. mientras se edita): no se puede cerrar. */
  readonly forceOpen = input(false);

  private readonly toggled = signal<boolean | null>(null);
  protected readonly isOpen = computed(() => this.forceOpen() || (this.toggled() ?? this.startOpen()));

  protected toggle(): void {
    if (this.forceOpen()) return;
    this.toggled.set(!this.isOpen());
  }
}
