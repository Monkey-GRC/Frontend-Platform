import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { Section } from '@shared/presentation/components/section/section';
import { Tag } from '@shared/presentation/components/tag/tag';
import { Badge } from '@shared/presentation/components/badge/badge';
import { IntegrationDetail } from '@features/integrations/domain/models/integration.models';

// «Qué evalúa»: los tipos de recurso que descubre y las pruebas, controles y marcos que alimenta. Alimentar no es cumplir: la nota lo dice siempre.
@Component({
  selector: 'app-integration-coverage',
  imports: [Badge, EmptyState, Section, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-4' },
  template: `
    @let d = detail();
    @if (d.resource_types.length === 0 && !d.coverage) {
      <app-empty-state icon="" titleKey="INTEGRATIONS.EVALUATES.EMPTY_TITLE" />
    }
    @if (d.resource_types.length) {
      <app-section titleKey="INTEGRATIONS.EVALUATES.RESOURCES_TITLE" data-test-resources>
        <ul class="flex flex-wrap gap-1.5">
          @for (k of d.resource_types; track k) {
            <li><app-badge kind="attribute" [value]="k">{{ labels.of('INTEGRATIONS.RESOURCE_KIND', k) }}</app-badge></li>
          }
        </ul>
      </app-section>
    }
    @if (d.coverage; as cov) {
      @let tests = (cov.tests.length === 1 ? 'INTEGRATIONS.COUNT.TESTS_ONE' : 'INTEGRATIONS.COUNT.TESTS_MANY') | translate: { count: cov.tests.length };
      @let controls = (cov.controls_count === 1 ? 'INTEGRATIONS.COUNT.CONTROLS_ONE' : 'INTEGRATIONS.COUNT.CONTROLS_MANY') | translate: { count: cov.controls_count };
      @let frameworks = (cov.frameworks.length === 1 ? 'INTEGRATIONS.COUNT.FRAMEWORKS_ONE' : 'INTEGRATIONS.COUNT.FRAMEWORKS_MANY') | translate: { count: cov.frameworks.length };
      <app-section titleKey="INTEGRATIONS.EVALUATES.COVERAGE_TITLE" data-test-coverage>
        <p class="text-sm text-ink" data-test-summary>{{ 'INTEGRATIONS.EVALUATES.SUMMARY' | translate: { tests: tests, controls: controls, frameworks: frameworks } }}</p>
        <h3 class="mt-4 text-sm font-semibold text-ink">{{ 'INTEGRATIONS.EVALUATES.TESTS_TITLE' | translate }}</h3>
        <ul class="mt-2 divide-y divide-line">
          @for (t of cov.tests; track t.code) {
            <li class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-sm" data-test-test>
              <app-tag [text]="t.code" />
              <span class="min-w-0 text-ink">{{ t.name }}</span>
            </li>
          }
        </ul>
        @if (cov.frameworks.length) {
          <h3 class="mt-4 text-sm font-semibold text-ink">{{ 'INTEGRATIONS.EVALUATES.FRAMEWORKS_TITLE' | translate }}</h3>
          <ul class="mt-2 divide-y divide-line">
            @for (f of cov.frameworks; track f.code) {
              <li class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm" data-test-framework>
                <app-badge kind="attribute" [value]="f.code">{{ f.name }}</app-badge>
                <span class="text-ink-muted">{{ (f.controls_count === 1 ? 'INTEGRATIONS.COUNT.CONTROLS_ONE' : 'INTEGRATIONS.COUNT.CONTROLS_MANY') | translate: { count: f.controls_count } }}</span>
              </li>
            }
          </ul>
        }
        <p class="mt-4 border-t border-line pt-3 text-sm text-ink-muted" data-test-note>{{ 'INTEGRATIONS.EVALUATES.NOTE' | translate }}</p>
      </app-section>
    }
  `,
})
export class IntegrationCoverage {
  readonly labels = inject(EnumLabelService);
  readonly detail = input.required<IntegrationDetail>();
}
