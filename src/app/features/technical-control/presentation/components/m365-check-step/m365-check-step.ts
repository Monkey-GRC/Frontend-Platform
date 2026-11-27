import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export type M365CheckState = 'checking' | 'waiting' | 'failed';
interface Row {
  key: string;
  state: 'done' | 'current' | 'pending' | 'failed';
}

// La comprobación del acceso, en vivo. Son segundos y el servidor no informa un porcentaje, así que no se inventa uno: se muestran los pasos REALES y en cuál va. Justo después de
// autorizar, Microsoft puede tardar en aplicar los permisos: se reintenta solo y se dice en qué intento va.
@Component({
  selector: 'app-m365-check-step',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="text-2xl font-semibold text-ink">{{ 'TECHNICAL_CONTROL.WIZARD.M365.CHECK.TITLE' | translate }}</h2>
    <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.M365.CHECK.SUBTITLE' | translate }}</p>

    <ol class="mt-8 divide-y divide-line rounded-card border border-line" aria-live="polite" data-check-list>
      @for (row of rows(); track row.key) {
        <li class="flex items-center gap-3 p-4 text-sm" [attr.data-row]="row.key" [attr.data-row-state]="row.state">
          @switch (row.state) {
            @case ('done') { <span class="material-symbols-rounded text-[24px] text-ok-ink" aria-hidden="true">check_circle</span> }
            @case ('current') { <span class="material-symbols-rounded animate-spin text-[24px] text-action" data-long-process aria-hidden="true">progress_activity</span> }
            @case ('failed') { <span class="material-symbols-rounded text-[24px] text-bad-ink" aria-hidden="true">error</span> }
            @default { <span class="material-symbols-rounded text-[24px] text-ink-faint" aria-hidden="true">radio_button_unchecked</span> }
          }
          <span [class]="row.state === 'pending' ? 'text-ink-faint' : 'text-ink'">{{ 'TECHNICAL_CONTROL.WIZARD.M365.CHECK.' + row.key | translate }}</span>
          <span class="sr-only">{{ 'TECHNICAL_CONTROL.WIZARD.M365.CHECK.STATE_' + row.state.toUpperCase() | translate }}</span>
        </li>
      }
    </ol>

    @if (state() === 'waiting') {
      <p class="mt-6 p-3.5 text-sm text-ink mk-surface-tinted" role="status" data-waiting>{{ 'TECHNICAL_CONTROL.WIZARD.M365.CHECK.WAITING' | translate: { attempt: attempt(), total: attempts() } }}</p>
    }
    @if (state() === 'failed' && message(); as m) {
      <p class="mt-6 p-3.5 text-sm mk-surface-state-bad text-ink" role="alert" data-message>{{ m }}</p>
    }
  `,
})
export class M365CheckStep {
  readonly state = input.required<M365CheckState>();
  readonly attempt = input(1);
  readonly attempts = input(1);
  readonly message = input<string | null>(null);

  readonly rows = computed<Row[]>(() => {
    const failed = this.state() === 'failed';
    return [
      { key: 'AUTHORIZED', state: 'done' },
      { key: 'ACCESS', state: failed ? 'failed' : 'current' },
      { key: 'READY', state: 'pending' },
    ];
  });
}
