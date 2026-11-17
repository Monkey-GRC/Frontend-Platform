import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Field } from '@shared/presentation/components/field/field';
import { targetValue } from '@shared/presentation/utils/event-target';
import { cleanGcpProjectNumber } from '@features/technical-control/domain/utils/gcp-validation';
import { ConnectionProgress } from '../connection-progress/connection-progress';

// Último dato del cliente: el número de proyecto que imprime el comando. Mientras Monkey comprueba el acceso se ve el avance (es una estimación por tiempo y así se dice).
@Component({
  selector: 'app-gcp-check-step',
  imports: [Field, ConnectionProgress, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.GCP.CHECK.TITLE' | translate }}</h2>
    <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.GCP.CHECK.SUBTITLE' | translate }}</p>

    <div class="mt-8">
      <app-field labelKey="TECHNICAL_CONTROL.WIZARD.GCP.CHECK.NUMBER_LABEL" forId="gcp-project-number" hintKey="TECHNICAL_CONTROL.WIZARD.GCP.CHECK.NUMBER_HELP" [errorKey]="numberError()">
        <input id="gcp-project-number" class="mk-input font-mono" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="19" aria-describedby="gcp-project-number-hint gcp-project-number-error"
          [disabled]="busy()" [value]="projectNumber()" (input)="projectNumber.set(clean(targetValue($event)))" placeholder="407295138461" [attr.aria-invalid]="numberError() ? 'true' : null" />
      </app-field>
    </div>

    @if (message(); as m) {
      <p class="mt-6 p-3.5 text-sm text-ink" role="status" [class]="m.kind === 'error' ? 'mk-surface-state-bad' : 'mk-surface-tinted'" data-message>{{ m.text }}</p>
    }
    @if (busy()) {
      <app-connection-progress />
    }
  `,
})
export class GcpCheckStep {
  protected readonly targetValue = targetValue;
  protected readonly clean = cleanGcpProjectNumber;

  readonly projectNumber = model('');
  readonly busy = input(false);
  readonly numberError = input<string | null>(null);
  readonly message = input<{ kind: 'error' | 'info'; text: string } | null>(null);
}
