import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ServiceListItem } from '@shared/domain/models/service.models';
import { ServiceService } from '@shared/domain/services/service.service';
import { FormModal } from '@shared/presentation/components/form-modal/form-modal';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { CatalogIntegration } from '@features/integrations/domain/models/integration.models';

type Stage = 'loading' | 'error' | 'ready';

// «Conectar»: se elige el servicio al que va la conexión y se sigue por el flujo de conexión de ese servicio. Lo usan «Agregar integración» y el detalle.
@Component({
  selector: 'app-integration-connect-modal',
  imports: [FormModal, LoadingSpinner, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-modal [open]="target() !== null" titleKey="INTEGRATIONS.PICK.TITLE" [titleParams]="{ name: target()?.name }" descriptionKey="INTEGRATIONS.PICK.DESCRIPTION" size="md" cancelLabelKey="COMMON.CANCEL" testId="pick-service" (closed)="closed.emit()">
      @switch (stage()) {
        @case ('loading') { <app-loading-spinner /> }
        @case ('error') {
          <p class="text-sm text-bad">{{ 'INTEGRATIONS.PICK.LOAD_ERROR' | translate }}</p>
        }
        @default {
          @if (serviceList().length === 0) {
            <p class="text-sm text-ink-muted" data-test-no-services>
              {{ 'INTEGRATIONS.PICK.NO_SERVICES' | translate }}
              <a routerLink="/services" class="font-medium text-action hover:underline" (click)="closed.emit()">{{ 'INTEGRATIONS.PICK.GO_SERVICES' | translate }}</a>
            </p>
          } @else {
            <ul class="space-y-2">
              @for (s of serviceList(); track s.id) {
                <li>
                  <button type="button" (click)="choose(s)" data-test-service
                    class="flex w-full items-center justify-between gap-3 rounded-control border border-line bg-surface px-4 py-3 text-left text-sm font-medium text-ink transition hover:border-action/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-action">
                    <span>{{ s.name }}</span>
                    <span class="material-symbols-rounded text-[18px] text-ink-muted" aria-hidden="true">chevron_right</span>
                  </button>
                </li>
              }
            </ul>
          }
        }
      }
    </app-form-modal>
  `,
})
export class IntegrationConnectModal {
  private readonly services = inject(ServiceService);
  private readonly router = inject(Router);

  /** La integración que se quiere conectar; `null` = cerrado. */
  readonly target = input<Pick<CatalogIntegration, 'name' | 'connection'> | null>(null);
  readonly closed = output<void>();

  readonly stage = signal<Stage>('loading');
  readonly serviceList = signal<ServiceListItem[]>([]);

  constructor() {
    effect(() => {
      if (this.target()) untracked(() => this.load());
    });
  }

  private load(): void {
    this.stage.set('loading');
    this.services.list().subscribe({
      next: (page) => {
        this.serviceList.set(page.items);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  choose(service: ServiceListItem): void {
    const connection = this.target()?.connection;
    if (!connection) return;
    this.closed.emit();
    void this.router.navigate(['/services', service.id, 'connections', 'new', connection.category, connection.platform]);
  }
}
