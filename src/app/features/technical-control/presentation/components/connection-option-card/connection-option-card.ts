import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ConnectionOption } from '@shared/domain/models/catalog.models';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { optionIcon } from './option-icons';

/**
 * Una opción seleccionable de un asistente de conexión (un radio con aspecto de tarjeta). Todo sale de la opción que sirve el backend: nombre, explicación, etiquetas (su texto es de i18n) y si ya se puede elegir.
 * Una opción `coming_soon` se muestra bloqueada con «Próximamente» en texto y `aria-disabled`, y no se puede elegir. Va dentro de un `role="radiogroup"`.
 */
@Component({
  selector: 'app-connection-option-card',
  imports: [StatusIndicator, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex' },
  template: `
    <button type="button" role="radio" [attr.aria-checked]="selected()" [attr.aria-disabled]="disabled() ? 'true' : null" (click)="choose()" data-option-card
      class="flex min-h-11 w-full flex-col gap-2 rounded-control border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
      [class]="disabled() ? 'cursor-not-allowed border-dashed border-line bg-canvas' : selected() ? 'border-action bg-tint' : 'border-line bg-surface hover:border-action/60'">
      <span class="flex items-center gap-3">
        <span class="material-symbols-rounded text-[24px]" [class]="selected() && !disabled() ? 'text-action' : 'text-ink-muted'" aria-hidden="true">{{ icon() }}</span>
        <span class="min-w-0 flex-1 text-sm font-semibold text-ink">{{ option().label }}</span>
        @if (selected() && !disabled()) {
          <span class="material-symbols-rounded text-[20px] text-action" aria-hidden="true">check_circle</span>
        }
      </span>
      <span class="text-sm text-ink-muted">{{ option().description }}</span>
      <span class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-ink-muted">
        @if (disabled()) {
          <app-status-indicator tone="neutral" labelKey="TECHNICAL_CONTROL.WIZARD.SOON" />
        } @else {
          @for (tag of option().tags; track tag) {
            <span class="font-medium text-ink" data-option-tag>{{ 'TECHNICAL_CONTROL.WIZARD.TAG_' + tag.toUpperCase() | translate }}</span>
          }
        }
      </span>
    </button>
  `,
})
export class ConnectionOptionCard {
  readonly option = input.required<ConnectionOption>();
  readonly selected = input(false);

  readonly picked = output<string>();

  protected readonly icon = computed(() => optionIcon(this.option().value));
  protected readonly disabled = computed(() => this.option().availability !== 'available');

  protected choose(): void {
    if (!this.disabled()) this.picked.emit(this.option().value);
  }
}
