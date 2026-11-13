import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

export type OptionsLoadState = 'loading' | 'error' | 'ready';

/** Lo que se ve mientras las opciones del catálogo cargan o si fallaron (con «Reintentar»); con `ready` muestra su contenido. */
@Component({
  selector: 'app-connection-options-state',
  imports: [EmptyState, TranslatePipe, Skeleton, SkeletonRegion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('loading') {
        <app-skeleton-region data-options-loading><div class="space-y-3"><app-skeleton shape="block" height="4rem" /><app-skeleton shape="block" height="4rem" /><app-skeleton shape="block" height="4rem" /></div></app-skeleton-region>
      }
      @case ('error') {
        <app-empty-state icon="" titleKey="TECHNICAL_CONTROL.WIZARD.OPTIONS_ERROR">
          <button action type="button" (click)="retry.emit()" class="mk-btn" data-options-retry>{{ 'COMMON.RETRY' | translate }}</button>
        </app-empty-state>
      }
      @default {
        <ng-content />
      }
    }
  `,
})
export class ConnectionOptionsState {
  readonly state = input.required<OptionsLoadState>();

  readonly retry = output<void>();
}
