import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ConnectionOption } from '@shared/domain/models/catalog.models';
import { isSelectable } from '@features/technical-control/domain/utils/connection-options';
import { ConnectionOptionCard } from '../connection-option-card/connection-option-card';

/** Un grupo de opciones del catálogo («¿Cómo das el acceso?»): un radiogroup con una tarjeta por opción. Solo emite la elección de una opción disponible. */
@Component({
  selector: 'app-connection-option-group',
  imports: [ConnectionOptionCard, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <h3 [id]="groupId() + '-title'" class="text-base font-semibold text-ink">{{ titleKey() | translate }}</h3>
    <div class="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" [attr.aria-labelledby]="groupId() + '-title'" data-option-group>
      @for (o of options(); track o.value) {
        <app-connection-option-card [option]="o" [selected]="value() === o.value" (picked)="choose($event)" [attr.data-option]="o.value" />
      }
    </div>
  `,
})
export class ConnectionOptionGroup {
  readonly groupId = input.required<string>();
  readonly titleKey = input.required<string>();
  readonly options = input.required<ConnectionOption[]>();
  readonly value = input<string | null>(null);

  readonly valueChange = output<string>();

  protected choose(value: string): void {
    if (isSelectable(this.options(), value)) this.valueChange.emit(value);
  }
}
