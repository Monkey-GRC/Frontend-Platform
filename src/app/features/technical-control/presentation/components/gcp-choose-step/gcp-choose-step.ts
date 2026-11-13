import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ConnectionOption } from '@shared/domain/models/catalog.models';
import { ConnectionOptionGroup } from '../connection-option-group/connection-option-group';
import { ConnectionOptionsState, OptionsLoadState } from '../connection-options-state/connection-options-state';

// Primera pantalla de GCP: «¿Cómo quieres conectar GCP?». Las opciones (alcance y método) las sirve el backend; las `coming_soon` van bloqueadas y la disponible llega preseleccionada.
@Component({
  selector: 'app-gcp-choose-step',
  imports: [ConnectionOptionGroup, ConnectionOptionsState, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.GCP.CHOOSE.TITLE' | translate }}</h2>
    <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.GCP.CHOOSE.SUBTITLE' | translate }}</p>

    <div class="mt-8">
      <app-connection-options-state [state]="state()" (retry)="retry.emit()">
        <app-connection-option-group groupId="gcp-scope" titleKey="TECHNICAL_CONTROL.WIZARD.GCP.CHOOSE.SCOPE_TITLE" [options]="scopes()" [value]="scope()" (valueChange)="scopeChange.emit($event)" data-scope-group />
        <app-connection-option-group class="mt-8" groupId="gcp-method" titleKey="TECHNICAL_CONTROL.WIZARD.GCP.CHOOSE.METHOD_TITLE" [options]="methods()" [value]="method()" (valueChange)="methodChange.emit($event)" data-method-group />
        <p class="mt-6 text-xs text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.GCP.CHOOSE.READ_ONLY' | translate }}</p>
      </app-connection-options-state>
    </div>
  `,
})
export class GcpChooseStep {
  readonly state = input.required<OptionsLoadState>();
  readonly scopes = input<ConnectionOption[]>([]);
  readonly methods = input<ConnectionOption[]>([]);
  readonly scope = input<string | null>(null);
  readonly method = input<string | null>(null);

  readonly scopeChange = output<string>();
  readonly methodChange = output<string>();
  readonly retry = output<void>();
}
