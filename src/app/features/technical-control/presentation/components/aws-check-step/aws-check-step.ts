import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Field } from '@shared/presentation/components/field/field';
import { targetValue } from '@shared/presentation/utils/event-target';
import { ConnectionProgress } from '../connection-progress/connection-progress';

// Último paso de AWS: con el rol, el cliente pega el ARN que le dio la pila y Monkey comprueba el acceso; con llaves no hay nada que pegar, solo comprobar. Mientras se comprueba se ve
// el avance (es una estimación por tiempo y así se dice).
@Component({
  selector: 'app-aws-check-step',
  imports: [Field, ConnectionProgress, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.CHECK.TITLE' | translate }}</h2>
    @if (method() === 'readonly_role') {
      <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.CHECK.ROLE_SUBTITLE' | translate }}</p>
      <div class="mt-8">
        <app-field labelKey="TECHNICAL_CONTROL.EDIT.ROLE" forId="aws-role-arn" hintKey="TECHNICAL_CONTROL.PANEL.ROLE_HELP" [errorKey]="roleError()">
          <input id="aws-role-arn" class="mk-input font-mono" type="text" autocomplete="off" spellcheck="false" aria-describedby="aws-role-arn-hint aws-role-arn-error" [disabled]="busy()"
            [value]="roleArn()" (input)="roleArn.set(targetValue($event).trim())" placeholder="arn:aws:iam::123456789012:role/MonkeyReadOnly" [attr.aria-invalid]="roleError() ? 'true' : null" />
        </app-field>
      </div>
    } @else {
      <p class="mt-2 text-sm text-ink-muted" data-keys-check>{{ 'TECHNICAL_CONTROL.WIZARD.AWS.CHECK.KEYS_SUBTITLE' | translate }}</p>
    }

    @if (message(); as m) {
      <p class="mt-6 p-3.5 text-sm text-ink" role="status" [class]="m.kind === 'error' ? 'mk-surface-state-bad' : 'mk-surface-tinted'" data-message>{{ m.text }}</p>
    }
    @if (busy()) {
      <app-connection-progress />
    }
  `,
})
export class AwsCheckStep {
  protected readonly targetValue = targetValue;

  readonly method = input.required<'readonly_role' | 'access_keys'>();
  readonly roleArn = model('');
  readonly busy = input(false);
  readonly roleError = input<string | null>(null);
  readonly message = input<{ kind: 'error' | 'info'; text: string } | null>(null);
}
