import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

// Un valor que el cliente pega en otra consola (no es un secreto): su nombre, para qué sirve, el valor y un botón que lo copia.
@Component({
  selector: 'app-copy-value',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="text-xs text-ink-muted"><code class="font-mono font-semibold text-ink">{{ label() }}</code> · {{ hintKey() | translate }}</p>
    <div class="mt-1 flex items-center gap-2">
      <code class="min-w-0 flex-1 truncate rounded-control bg-canvas px-3 py-2 font-mono text-xs text-ink" [title]="value()" data-copy-value>{{ value() || '—' }}</code>
      <button type="button" (click)="copy()" [disabled]="!value()" data-copy class="mk-btn-secondary shrink-0 px-3 py-2 text-xs">
        <span class="material-symbols-rounded text-[16px]" aria-hidden="true">{{ copied() ? 'check' : 'content_copy' }}</span>
        {{ (copied() ? 'TECHNICAL_CONTROL.PANEL.COPIED' : 'TECHNICAL_CONTROL.PANEL.COPY') | translate }}
      </button>
    </div>
  `,
})
export class CopyValue {
  readonly label = input.required<string>();
  readonly hintKey = input.required<string>();
  readonly value = input('');
  readonly copied = signal(false);

  copy(): void {
    const value = this.value();
    if (!value) return;
    navigator.clipboard?.writeText(value).then(
      () => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 1800);
      },
      () => undefined,
    );
  }
}
