import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Asset } from '@shared/domain/models/technical-control.models';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';

// Resultado de cualquier plataforma: la conexión quedó comprobada. Lo que sigue (elegir qué activos son del servicio y activar la evaluación) se hace en la conexión. Los textos de la plataforma llegan por clave.
@Component({
  selector: 'app-connection-result-step',
  imports: [Tag, StatusIndicator, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-center">
      <span class="material-symbols-rounded text-[44px] text-ok-ink" aria-hidden="true">task_alt</span>
      <h2 class="mt-2 text-2xl font-semibold text-ink" data-result-title>{{ titleKey() | translate }}</h2>
      <p class="mt-2 text-sm text-ink-muted">{{ subtitleKey() | translate }}</p>
    </div>

    <dl class="mt-8 divide-y divide-line rounded-control border border-line text-sm">
      <div class="flex items-center justify-between gap-4 p-3.5">
        <dt class="text-ink-muted">{{ accountLabelKey() | translate }}</dt>
        <dd data-result-project><app-tag size="md" [text]="asset().external_account_id ?? '—'" /></dd>
      </div>
      <div class="flex items-center justify-between gap-4 p-3.5">
        <dt class="text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.RESULT.NAME' | translate }}</dt>
        <dd class="text-ink">{{ asset().name }}</dd>
      </div>
      <div class="flex items-center justify-between gap-4 p-3.5">
        <dt class="text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.RESULT.STATUS' | translate }}</dt>
        <dd><app-status-indicator tone="ok" labelKey="TECHNICAL_CONTROL.STATUS.VALIDATED" /></dd>
      </div>
    </dl>

    @if (demo()) {
      <p class="mt-6 p-3.5 text-sm mk-surface-state-warn text-ink" role="status" data-demo>{{ 'TECHNICAL_CONTROL.CARD.DEMO' | translate }}</p>
    }
    <p class="mt-6 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.RESULT.NEXT' | translate }}</p>
  `,
})
export class ConnectionResultStep {
  readonly asset = input.required<Asset>();
  readonly titleKey = input.required<string>();
  readonly subtitleKey = input.required<string>();
  readonly accountLabelKey = input.required<string>();
  // La evaluación es simulada: la conexión no es real y hay que decirlo.
  readonly demo = input(false);
}
