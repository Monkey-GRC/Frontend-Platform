import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { ConnectionCommonFields } from '../connection-common-fields/connection-common-fields';

// Primera pantalla de Microsoft 365: solo cómo se llamará la conexión y qué tan importante es. No se pide ningún identificador ni contraseña: la organización la pone Microsoft
// cuando el administrador autoriza. Antes de seguir se dice, en tres líneas, qué hará Monkey y qué no.
@Component({
  selector: 'app-m365-data-step',
  imports: [ConnectionCommonFields, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.M365.DATA.TITLE' | translate }}</h2>
    <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.M365.DATA.SUBTITLE' | translate }}</p>

    <div class="mt-8">
      <app-connection-common-fields idPrefix="m365" namePlaceholderKey="TECHNICAL_CONTROL.WIZARD.M365.DATA.NAME_PLACEHOLDER" [(name)]="name" [(criticality)]="criticality" [(extraServiceIds)]="extraServiceIds"
        [criticalities]="criticalities()" [otherServices]="otherServices()" [showHints]="showHints()" />
    </div>

    <ul class="mt-8 space-y-3 p-4 mk-surface-tinted" data-promises>
      @for (item of promises; track item.key) {
        <li class="flex gap-3 text-sm text-ink">
          <span class="material-symbols-rounded shrink-0 text-[20px] text-action" aria-hidden="true">{{ item.icon }}</span>
          <span>{{ 'TECHNICAL_CONTROL.WIZARD.M365.DATA.' + item.key | translate }}</span>
        </li>
      }
    </ul>

    @if (error(); as e) {
      <p class="mt-6 p-3.5 text-sm mk-surface-state-bad text-ink" role="alert" data-error>{{ e }}</p>
    }
  `,
})
export class M365DataStep {
  protected readonly promises = [
    { key: 'PROMISE_READ', icon: 'visibility' },
    { key: 'PROMISE_NO_CHANGES', icon: 'lock' },
    { key: 'PROMISE_NO_SECRETS', icon: 'password_2_off' },
  ];

  readonly name = model('');
  readonly criticality = model('medium');
  readonly extraServiceIds = model<string[]>([]);

  readonly criticalities = input<CatalogOption[]>([]);
  readonly otherServices = input<{ id: string; name: string }[]>([]);
  readonly showHints = input(false);
  readonly error = input<string | null>(null);
}
