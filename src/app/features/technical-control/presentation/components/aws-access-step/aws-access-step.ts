import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ConnectionSetup } from '@shared/domain/models/technical-control.models';
import { Field } from '@shared/presentation/components/field/field';
import { targetValue } from '@shared/presentation/utils/event-target';
import { CopyValue } from '../copy-value/copy-value';
import { RoleTemplateDownload } from '../role-template-download/role-template-download';

// «Dar acceso». Con el rol (recomendado), el cliente descarga la plantilla, la despliega en SU cuenta y copia dos valores que Monkey le da; los pasos llegan del backend, ya en su
// idioma, y nada aquí es un secreto. Con llaves (alternativa menos segura), pega la llave de solo lectura: viaja una vez, se guarda cifrada y no se vuelve a mostrar.
@Component({
  selector: 'app-aws-access-step',
  imports: [Field, CopyValue, RoleTemplateDownload, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (method() === 'access_keys') {
      <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.ACCESS.KEYS_TITLE' | translate }}</h2>
      <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.ACCESS.KEYS_SUBTITLE' | translate }}</p>
      <p class="mt-6 p-3.5 text-sm mk-surface-state-warn text-ink" role="note" data-keys-warning>{{ 'TECHNICAL_CONTROL.FORM.KEYS_NOTE' | translate }}</p>
      <div class="mt-6 space-y-6">
        <app-field labelKey="TECHNICAL_CONTROL.FORM.KEY_ID" forId="aws-key-id" [errorKey]="keyIdError()">
          <input id="aws-key-id" class="mk-input font-mono" type="text" autocomplete="off" spellcheck="false" [value]="accessKeyId()" (input)="accessKeyId.set(targetValue($event).trim())"
            aria-describedby="aws-key-id-error" [attr.aria-invalid]="keyIdError() ? 'true' : null" />
        </app-field>
        <app-field labelKey="TECHNICAL_CONTROL.EDIT.SECRET" forId="aws-key-secret" [errorKey]="secretError()">
          <input id="aws-key-secret" class="mk-input font-mono" type="password" autocomplete="off" spellcheck="false" [value]="secretAccessKey()" (input)="secretAccessKey.set(targetValue($event).trim())"
            aria-describedby="aws-key-secret-error" [attr.aria-invalid]="secretError() ? 'true' : null" />
        </app-field>
      </div>
      @if (error(); as e) {
        <p class="mt-6 p-3.5 text-sm mk-surface-state-bad text-ink" role="alert" data-error>{{ e }}</p>
      }
    } @else {
      <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.ACCESS.ROLE_TITLE' | translate }}</h2>
      <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.ACCESS.ROLE_SUBTITLE' | translate }}</p>

      @if (setup(); as s) {
        <ol class="mt-8 space-y-4" data-steps>
          @for (step of s.steps; track $index) {
            <li class="flex gap-3 text-sm text-ink-muted">
              <span class="flex size-6 shrink-0 items-center justify-center rounded-control bg-tint-strong text-xs font-semibold text-tint-ink" aria-hidden="true">{{ $index + 1 }}</span>
              <span>{{ step }}</span>
            </li>
          }
        </ol>

        <div class="mt-6"><app-role-template-download /></div>

        <div class="mt-8 space-y-4">
          <h3 class="text-base font-semibold text-ink">{{ 'TECHNICAL_CONTROL.PANEL.PASTE_VALUES' | translate }}</h3>
          <app-copy-value label="ExternalId" hintKey="TECHNICAL_CONTROL.PANEL.HINT_EXTERNAL_ID" [value]="s.external_id ?? ''" />
          <app-copy-value label="MonkeyPrincipalArn" hintKey="TECHNICAL_CONTROL.PANEL.HINT_PRINCIPAL" [value]="s.monkey_principal_arn ?? ''" />
          @if (!s.monkey_principal_arn) {
            <p class="p-3.5 text-sm mk-surface-state-warn text-ink" role="status" data-no-principal>{{ 'TECHNICAL_CONTROL.PANEL.MISSING_PRINCIPAL' | translate }}</p>
          }
        </div>
        <p class="mt-6 text-xs text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.ACCESS.NO_KEYS' | translate }}</p>
      }
    }
  `,
})
export class AwsAccessStep {
  protected readonly targetValue = targetValue;

  readonly method = input.required<'readonly_role' | 'access_keys'>();
  readonly setup = input<ConnectionSetup | null>(null);

  readonly accessKeyId = model('');
  readonly secretAccessKey = model('');
  readonly showHints = input(false);
  readonly fieldErrors = input<Record<string, string>>({});
  readonly error = input<string | null>(null);

  readonly keyIdError = computed(() => this.fieldErrors()['access_key_id'] ?? (this.showHints() && !this.accessKeyId() ? 'TECHNICAL_CONTROL.WIZARD.AWS.ACCESS.KEY_REQUIRED' : null));
  readonly secretError = computed(() => this.fieldErrors()['secret_access_key'] ?? (this.showHints() && !this.secretAccessKey() ? 'TECHNICAL_CONTROL.WIZARD.AWS.ACCESS.SECRET_REQUIRED' : null));
}
