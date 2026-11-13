import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ConnectionSetup } from '@shared/domain/models/technical-control.models';

// El comando que el cliente pega en SU Cloud Shell para dar acceso de solo lectura a Monkey, sin claves. Los pasos llegan del backend, ya en el idioma del cliente. El comando no
// es un secreto (lleva el identificador externo de la conexión, que Monkey genera): aun así solo se muestra aquí, al darlo de alta, y se copia con un botón.
@Component({
  selector: 'app-gcp-access-step',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.GCP.ACCESS.TITLE' | translate }}</h2>
    <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.GCP.ACCESS.SUBTITLE' | translate: { project: setup().project_id ?? '' } }}</p>

    <ol class="mt-8 space-y-4" data-steps>
      @for (step of setup().steps; track $index) {
        <li class="flex gap-3 text-sm text-ink-muted">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-control bg-tint-strong text-xs font-semibold text-tint-ink" aria-hidden="true">{{ $index + 1 }}</span>
          <span>{{ step }}</span>
        </li>
      }
    </ol>

    <div class="mt-8">
      <div class="flex items-center justify-between gap-3">
        <h3 id="gcp-command-title" class="text-base font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.GCP.ACCESS.COMMAND' | translate }}</h3>
        <button type="button" (click)="copy()" [disabled]="!command()" data-copy class="mk-btn-secondary px-3 py-2 text-xs">
          <span class="material-symbols-rounded text-[16px]" aria-hidden="true">{{ copied() ? 'check' : 'content_copy' }}</span>
          {{ (copied() ? 'TECHNICAL_CONTROL.PANEL.COPIED' : 'TECHNICAL_CONTROL.PANEL.COPY') | translate }}
        </button>
      </div>
      @if (command(); as c) {
        <pre class="mt-3 max-h-56 overflow-auto rounded-control border border-line bg-canvas p-3 font-mono text-xs text-ink" tabindex="0" aria-labelledby="gcp-command-title" data-command>{{ c }}</pre>
      } @else {
        <p class="mt-3 p-3.5 text-sm mk-surface-state-warn text-ink" role="status" data-no-command>{{ 'TECHNICAL_CONTROL.WIZARD.GCP.ACCESS.NO_COMMAND' | translate }}</p>
      }
      <p class="mt-3 text-xs text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.GCP.ACCESS.NO_KEYS' | translate }}</p>
    </div>
  `,
})
export class GcpAccessStep {
  readonly setup = input.required<ConnectionSetup>();
  readonly copied = signal(false);

  command(): string {
    return this.setup().setup_command ?? '';
  }

  copy(): void {
    const value = this.command();
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
