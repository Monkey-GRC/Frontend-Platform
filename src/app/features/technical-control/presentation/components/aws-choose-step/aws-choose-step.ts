import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ConnectionOption } from '@shared/domain/models/catalog.models';
import { ConnectionOptionGroup } from '../connection-option-group/connection-option-group';
import { ConnectionOptionsState, OptionsLoadState } from '../connection-options-state/connection-options-state';

// Primera pantalla de AWS: «¿Cómo quieres conectar AWS?». Las formas de dar el acceso las sirve el backend con sus etiquetas (el rol, recomendado; las llaves, menos seguras).
@Component({
  selector: 'app-aws-choose-step',
  imports: [ConnectionOptionGroup, ConnectionOptionsState, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.CHOOSE.TITLE' | translate }}</h2>
    <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.CHOOSE.SUBTITLE' | translate }}</p>

    <div class="mt-8">
      <app-connection-options-state [state]="state()" (retry)="retry.emit()">
        <app-connection-option-group groupId="aws-method" titleKey="TECHNICAL_CONTROL.WIZARD.AWS.CHOOSE.METHOD_TITLE" [options]="methods()" [value]="method()" (valueChange)="methodChange.emit($event)" data-method-group />
        <p class="mt-6 text-xs text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.AWS.CHOOSE.READ_ONLY' | translate }}</p>
      </app-connection-options-state>
    </div>
  `,
})
export class AwsChooseStep {
  readonly state = input.required<OptionsLoadState>();
  readonly methods = input<ConnectionOption[]>([]);
  readonly method = input<string | null>(null);

  readonly methodChange = output<string>();
  readonly retry = output<void>();
}
