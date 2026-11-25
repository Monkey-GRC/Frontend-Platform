import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { Card } from '@shared/presentation/components/card/card';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';
import { IntegrationConnection } from '@features/integrations/domain/models/integration.models';
import { connectionLink, connectionTone } from '@features/integrations/domain/utils/integration-look';

// Las conexiones de la empresa a esta integración. «Necesita atención» es un problema de conexión, no de cumplimiento (D57). El administrador llega a cada conexión por servicio.
@Component({
  selector: 'app-integration-connections',
  imports: [Tag, Card, RouterLink, StatusIndicator, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <h2 class="text-lg font-semibold text-ink">{{ 'INTEGRATIONS.CONNECTIONS.TITLE' | translate: { count: connections().length } }}</h2>
    <p class="mt-1 text-sm text-ink-muted" data-test-attention-note>{{ 'INTEGRATIONS.ATTENTION.BODY' | translate }}</p>
    <ul class="mt-4 space-y-3" data-test-connections>
      @for (c of connections(); track c.asset_id) {
        <li>
          <app-card data-test-connection>
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0">
                <app-tag [text]="c.code" />
                <p class="font-medium text-ink">{{ c.name }}</p>
              </div>
              <app-status-indicator [tone]="tone(c.connection_status)" [label]="labels.of('TECHNICAL_CONTROL.STATUS', c.connection_status)" />
            </div>
            @if (c.needs_attention) {
              <div class="mt-2" data-test-connection-attention><app-status-indicator tone="warn" labelKey="INTEGRATIONS.STATUS.NEEDS_ATTENTION" /></div>
            }
            <dl class="mt-3 space-y-1 text-sm">
              <div class="flex gap-2"><dt class="text-ink-muted">{{ 'INTEGRATIONS.CONNECTIONS.OPERATIONAL' | translate }}</dt><dd class="text-ink">{{ labels.of('INTEGRATIONS.OPERATIONAL', c.operational_status) }}</dd></div>
              <div class="flex flex-wrap gap-2">
                <dt class="text-ink-muted">{{ 'INTEGRATIONS.CONNECTIONS.SERVICES' | translate }}</dt>
                <dd class="flex flex-wrap gap-x-3 text-ink">
                  @for (s of c.services; track s.id) {
                    @if (isAdmin()) {
                      <a [routerLink]="link(c, s.id)" class="mk-link underline" data-test-service-link>{{ s.name }}</a>
                    } @else {
                      <span>{{ s.name }}</span>
                    }
                  } @empty { <span class="text-ink-faint">—</span> }
                </dd>
              </div>
            </dl>
          </app-card>
        </li>
      }
    </ul>
  `,
})
export class IntegrationConnections {
  readonly labels = inject(EnumLabelService);
  readonly connections = input.required<IntegrationConnection[]>();
  readonly isAdmin = input(false);
  readonly link = connectionLink;
  readonly tone = connectionTone;
}
