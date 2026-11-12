import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { Card } from '@shared/presentation/components/card/card';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { IntegrationDetail } from '@features/integrations/domain/models/integration.models';

// El panel lateral del detalle: lo que la integración alimenta y el botón de conectar, y su ficha (quién la construye, para qué sirve y con qué funciona).
@Component({
  selector: 'app-integration-side-panel',
  imports: [Card, StatusIndicator, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-4' },
  template: `
    @let d = detail();
    @if (showActionCard()) {
      <app-card data-test-action-card>
        <div class="space-y-4">
          @if (d.coverage; as cov) {
            @let tests = (cov.tests.length === 1 ? 'INTEGRATIONS.COUNT.TESTS_ONE' : 'INTEGRATIONS.COUNT.TESTS_MANY') | translate: { count: cov.tests.length };
            @let controls = (cov.controls_count === 1 ? 'INTEGRATIONS.COUNT.CONTROLS_ONE' : 'INTEGRATIONS.COUNT.CONTROLS_MANY') | translate: { count: cov.controls_count };
            @let frameworks = (cov.frameworks.length === 1 ? 'INTEGRATIONS.COUNT.FRAMEWORKS_ONE' : 'INTEGRATIONS.COUNT.FRAMEWORKS_MANY') | translate: { count: cov.frameworks.length };
            <ul class="space-y-2 text-sm text-ink" data-test-feeds>
              <li class="flex items-start gap-2">
                <span class="material-symbols-rounded text-[20px] text-ink-muted" aria-hidden="true">science</span>
                <span>{{ 'INTEGRATIONS.SIDE.FEEDS' | translate: { tests: tests } }}</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="material-symbols-rounded text-[20px] text-ink-muted" aria-hidden="true">checklist</span>
                <span>{{ 'INTEGRATIONS.SIDE.CONTROLS_IN' | translate: { controls: controls, frameworks: frameworks } }}</span>
              </li>
            </ul>
          }
          @if (d.availability === 'coming_soon') {
            <app-status-indicator tone="neutral" labelKey="INTEGRATIONS.ADD.COMING_SOON" />
          } @else if (canConnect()) {
            <button type="button" class="mk-btn w-full" data-test-connect (click)="connect.emit()">
              {{ (d.connected ? 'INTEGRATIONS.ADD.CONNECT_ANOTHER' : 'INTEGRATIONS.ADD.CONNECT') | translate }}
            </button>
          }
        </div>
      </app-card>
    }
    <app-card>
      <dl class="space-y-4 text-sm" data-test-facts>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-ink-muted">{{ 'INTEGRATIONS.SIDE.BUILT_BY' | translate }}</dt>
          <dd class="mt-1 text-ink">{{ 'INTEGRATIONS.SIDE.BUILT_BY_VALUE' | translate }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-ink-muted">{{ 'INTEGRATIONS.SIDE.PURPOSE' | translate }}</dt>
          <dd class="mt-1 text-ink">{{ labels.of('INTEGRATIONS.PURPOSE', d.purpose) }}</dd>
        </div>
        @if (d.capabilities.length) {
          <div data-test-capabilities>
            <dt class="text-xs font-medium uppercase tracking-wide text-ink-muted">{{ 'INTEGRATIONS.SIDE.CAPABILITIES' | translate }}</dt>
            <dd class="mt-1.5"><ul class="flex flex-wrap gap-1.5">@for (c of d.capabilities; track c) {<li class="rounded-control border border-line px-2 py-1 text-xs text-ink">{{ c }}</li>}</ul></dd>
          </div>
        }
        @if (d.works_with.length) {
          <div data-test-works-with>
            <dt class="text-xs font-medium uppercase tracking-wide text-ink-muted">{{ 'INTEGRATIONS.SIDE.WORKS_WITH' | translate }}</dt>
            <dd class="mt-1.5"><ul class="flex flex-wrap gap-1.5">@for (w of d.works_with; track w) {<li class="rounded-control border border-line px-2 py-1 text-xs text-ink">{{ w }}</li>}</ul></dd>
          </div>
        }
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-ink-muted">{{ 'INTEGRATIONS.SIDE.AVAILABILITY' | translate }}</dt>
          <dd class="mt-1"><app-status-indicator [tone]="d.availability === 'available' ? 'ok' : 'neutral'" [label]="labels.of('INTEGRATIONS.AVAILABILITY', d.availability)" /></dd>
        </div>
      </dl>
    </app-card>
  `,
})
export class IntegrationSidePanel {
  readonly labels = inject(EnumLabelService);
  readonly detail = input.required<IntegrationDetail>();
  /** El administrador puede conectar; el auditor nunca ve botones. */
  readonly isAdmin = input(false);
  readonly connect = output<void>();

  readonly canConnect = computed(() => this.isAdmin() && this.detail().availability === 'available');
  readonly showActionCard = computed(() => this.detail().coverage !== null || this.detail().availability === 'coming_soon' || this.canConnect());
}
