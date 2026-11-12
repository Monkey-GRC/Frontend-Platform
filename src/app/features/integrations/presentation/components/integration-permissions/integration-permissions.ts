import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { Card } from '@shared/presentation/components/card/card';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';
import { IntegrationPermission } from '@features/integrations/domain/models/integration.models';
import { accessTone } from '@features/integrations/domain/utils/integration-look';

// «Permisos que pide Monkey»: una tarjeta por permiso, con su identificador técnico y si es de lectura o de escritura.
@Component({
  selector: 'app-integration-permissions',
  imports: [Card, EmptyState, StatusIndicator, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (permissions().length === 0) {
      <app-empty-state icon="" titleKey="INTEGRATIONS.PERMISSIONS.EMPTY_TITLE" />
    } @else {
      <h2 class="text-lg font-semibold text-ink">{{ 'INTEGRATIONS.PERMISSIONS.TITLE' | translate: { count: permissions().length } }}</h2>
      @if (readOnly()) {
        <p class="mt-1 text-sm text-ink-muted" data-test-read-only>{{ 'INTEGRATIONS.PERMISSIONS.READ_ONLY' | translate }}</p>
      }
      <ul class="mt-4 space-y-3">
        @for (p of permissions(); track p.name) {
          <li>
            <app-card data-test-permission>
              <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div class="min-w-0">
                  <h3 class="text-sm font-semibold text-ink">{{ p.name }}</h3>
                  @if (p.scope) {
                    <app-tag class="mt-0.5 block break-all" [text]="p.scope" />
                  }
                </div>
                <app-status-indicator [tone]="tone(p.access)" [label]="labels.of('INTEGRATIONS.ACCESS', p.access)" />
              </div>
              <p class="mt-2 text-sm text-ink-muted">{{ p.detail }}</p>
            </app-card>
          </li>
        }
      </ul>
    }
  `,
})
export class IntegrationPermissions {
  readonly labels = inject(EnumLabelService);
  readonly permissions = input.required<IntegrationPermission[]>();
  readonly tone = accessTone;
  readonly readOnly = computed(() => this.permissions().length > 0 && this.permissions().every((p) => p.access === 'read'));
}
