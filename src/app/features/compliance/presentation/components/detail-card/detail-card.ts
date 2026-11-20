import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

// Una sección del detalle de un control: el título y, a la derecha, sus acciones y el chevron que la abre o la cierra. Todas las secciones
// del detalle usan este mismo encabezado para que se lea como una sola estructura. Las acciones (p. ej. «Editar») se proyectan con el atributo `actions`.
@Component({
  selector: 'app-detail-card',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-control border border-line bg-surface" [attr.aria-label]="titleKey() | translate">
      <div class="flex items-center gap-3 px-4 py-3.5">
        <button type="button" class="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:text-ink-faint" [attr.aria-expanded]="isOpen()" [disabled]="forceOpen()" (click)="toggle()">
          <h4 class="text-base font-semibold text-ink">{{ titleKey() | translate }}</h4>
        </button>
        <ng-content select="[actions]" />
        <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-control text-ink-muted enabled:hover:bg-canvas disabled:cursor-not-allowed disabled:text-ink-faint"
          [disabled]="forceOpen()" tabindex="-1" aria-hidden="true" (click)="toggle()">
          <span class="material-symbols-rounded text-[24px] leading-none transition-transform" [class.rotate-180]="isOpen()">expand_more</span>
        </button>
      </div>
      @if (isOpen()) {
        <div class="px-4 pb-4"><ng-content /></div>
      }
    </section>
  `,
})
export class DetailCard {
  readonly titleKey = input.required<string>();
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
