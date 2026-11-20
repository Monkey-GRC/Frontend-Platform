import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { Card } from '@shared/presentation/components/card/card';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { IntegrationDetail } from '@features/integrations/domain/models/integration.models';
import { securityIcon } from '@features/integrations/domain/utils/integration-look';

// «Seguridad»: cómo protege Monkey la conexión, una tarjeta por tema (solo lo que el backend entrega: lo verificado).
@Component({
  selector: 'app-integration-security',
  imports: [Card, EmptyState, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (items().length === 0) {
      <app-empty-state icon="" titleKey="INTEGRATIONS.SECURITY.EMPTY_TITLE" />
    } @else {
      <h2 class="text-lg font-semibold text-ink">{{ 'INTEGRATIONS.SECURITY.TITLE' | translate }}</h2>
      <ul class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        @for (s of items(); track s.topic) {
          <li>
            <app-card class="h-full" data-test-security>
              <div class="flex items-start gap-3">
                <span class="material-symbols-rounded text-[24px] text-action" aria-hidden="true" data-test-security-icon>{{ icon(s.topic) }}</span>
                <div class="min-w-0">
                  <h3 class="text-sm font-semibold text-ink">{{ labels.of('INTEGRATIONS.SECURITY_TOPIC', s.topic) }}</h3>
                  <p class="mt-1 text-sm text-ink-muted">{{ s.text }}</p>
                </div>
              </div>
            </app-card>
          </li>
        }
      </ul>
    }
  `,
})
export class IntegrationSecurity {
  readonly labels = inject(EnumLabelService);
  readonly items = input.required<IntegrationDetail['security']>();
  readonly icon = securityIcon;
}
