import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Card } from '@shared/presentation/components/card/card';
import { ProviderLogo } from '@shared/presentation/components/provider-logo/provider-logo';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { CatalogIntegration } from '@features/integrations/domain/models/integration.models';

// Una tarjeta del catálogo (entera es un enlace al detalle: el nombre lleva el enlace extendido; el botón queda encima y no navega): logo, nombre, descripción (la manda el backend) y el pie según el estado. `coming_soon` va atenuada y sin botón.
@Component({
  selector: 'app-integration-card',
  imports: [NgTemplateOutlet, RouterLink, Card, ProviderLogo, StatusIndicator, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block h-full' },
  template: `
    <ng-template #body>
      <div class="flex h-full flex-col gap-3">
        <div class="flex items-center gap-3">
          <app-provider-logo [logoKey]="item().logo_key" size="card" />
          <h3 class="text-base font-semibold text-ink">
            <a [routerLink]="['/integraciones', item().code]" data-test-open class="rounded-control after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">{{ item().name }}</a>
          </h3>
        </div>
        <p class="text-sm text-ink-muted">{{ item().description }}</p>
        <div class="mt-auto flex items-center pt-1">
          @if (item().availability === 'coming_soon') {
            <app-status-indicator tone="neutral" labelKey="INTEGRATIONS.ADD.COMING_SOON" />
          } @else if (item().connected) {
            <div class="flex flex-wrap items-center gap-3">
              <app-status-indicator tone="ok" labelKey="INTEGRATIONS.ADD.CONNECTED" />
              <button type="button" class="mk-btn-secondary relative z-10" data-test-connect-another [attr.aria-label]="'INTEGRATIONS.ADD.CONNECT_ANOTHER_ARIA' | translate: { name: item().name }" (click)="$event.stopPropagation(); connect.emit(item())">
                {{ 'INTEGRATIONS.ADD.CONNECT_ANOTHER' | translate }}
              </button>
            </div>
          } @else {
            <button type="button" class="mk-btn-secondary relative z-10" data-test-connect [attr.aria-label]="'INTEGRATIONS.ADD.CONNECT_ARIA' | translate: { name: item().name }" (click)="$event.stopPropagation(); connect.emit(item())">
              {{ 'INTEGRATIONS.ADD.CONNECT' | translate }}
            </button>
          }
        </div>
      </div>
    </ng-template>
    @if (item().availability === 'coming_soon') {
      <div class="h-full rounded-control border border-dashed border-line bg-canvas p-5" data-test-coming-soon>
        <ng-container [ngTemplateOutlet]="body" />
      </div>
    } @else {
      <app-card class="h-full transition hover:border-action/60">
        <ng-container [ngTemplateOutlet]="body" />
      </app-card>
    }
  `,
})
export class IntegrationCard {
  readonly item = input.required<CatalogIntegration>();
  readonly connect = output<CatalogIntegration>();
}
