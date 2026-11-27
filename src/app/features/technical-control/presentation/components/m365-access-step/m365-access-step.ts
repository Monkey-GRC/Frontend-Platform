import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

// Antes de salir hacia Microsoft: qué va a pasar allá, quién tiene que hacerlo y por qué verá dos pantallas. Los pasos llegan del backend, ya en el idioma del cliente. Si volvió
// de Microsoft sin terminar, aquí se dice por qué y qué hacer.
@Component({
  selector: 'app-m365-access-step',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.M365.ACCESS.TITLE' | translate }}</h2>
    <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.M365.ACCESS.SUBTITLE' | translate }}</p>

    @if (errorKey(); as key) {
      <p class="mt-6 p-3.5 text-sm mk-surface-state-warn text-ink" role="alert" data-return-error>{{ key | translate }}</p>
    }
    @if (error(); as e) {
      <p class="mt-6 p-3.5 text-sm mk-surface-state-bad text-ink" role="alert" data-error>{{ e }}</p>
    }

    <ol class="mt-8 space-y-4" data-steps>
      @for (step of steps(); track $index) {
        <li class="flex gap-3 text-sm text-ink-muted">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-control bg-tint-strong text-xs font-semibold text-tint-ink" aria-hidden="true">{{ $index + 1 }}</span>
          <span>{{ step }}</span>
        </li>
      }
    </ol>

    <div class="mt-8 space-y-2 rounded-control border border-line bg-canvas p-4 text-sm text-ink-muted">
      <p><span class="font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.M365.ACCESS.WHO_TITLE' | translate }}</span> {{ 'TECHNICAL_CONTROL.WIZARD.M365.ACCESS.WHO' | translate }}</p>
      <p><span class="font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.M365.ACCESS.NAMES_TITLE' | translate }}</span> {{ 'TECHNICAL_CONTROL.WIZARD.M365.ACCESS.NAMES' | translate }}</p>
    </div>
  `,
})
export class M365AccessStep {
  readonly steps = input<string[]>([]);
  /** El motivo por el que volvió de Microsoft sin terminar, como clave de traducción. */
  readonly errorKey = input<string | null>(null);
  readonly error = input<string | null>(null);
}
