import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Skeleton } from '@shared/presentation/components/skeleton/skeleton';

/** D116 · La forma completa de `app-notification-card` mientras carga: el círculo del ícono, la línea de servicio y hora, el título, el resumen, la línea y el pie con códigos y enlace. */
@Component({
  selector: 'app-notification-card-skeleton',
  imports: [Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex h-full flex-col rounded-card border border-line bg-surface p-4" data-testid="notice-card-skeleton">
      <div class="flex items-start gap-3">
        <app-skeleton shape="circle" [size]="40" />
        <div class="min-w-0 flex-1 space-y-2.5 pt-0.5">
          <app-skeleton shape="line" width="45%" />
          <app-skeleton shape="line" width="85%" />
          <app-skeleton shape="line" width="65%" />
        </div>
      </div>
      <div class="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <div class="flex gap-1.5"><app-skeleton shape="badge" width="3.5rem" /><app-skeleton shape="badge" width="3rem" /><app-skeleton shape="badge" width="3rem" /></div>
        <app-skeleton shape="line" width="6rem" />
      </div>
    </div>
  `,
})
export class NotificationCardSkeleton {}
