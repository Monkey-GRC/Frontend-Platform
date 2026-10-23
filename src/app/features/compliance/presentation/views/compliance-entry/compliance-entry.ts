import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { ComplianceGeneral } from '../../components/compliance-general/compliance-general';
import { COMPLIANCE_ROUTE, ComplianceServiceRef } from '../../../domain/models/compliance.models';
import { ComplianceServicesService } from '../../../domain/services/compliance-services.service';

type Stage = 'loading' | 'error' | 'forbidden' | 'empty' | 'choose';

// Entrada del menú «Cumplimiento». El módulo vive dentro de cada servicio, así que desde aquí se llega a uno:
// con un solo servicio se entra directo; con varios, se ve el General: cómo va cada servicio en cada marco.
@Component({
  selector: 'app-compliance-entry',
  imports: [RouterLink, TranslatePipe, EmptyState, LoadingSpinner, ComplianceGeneral],
  templateUrl: './compliance-entry.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceEntryView implements OnInit {
  private readonly api = inject(ComplianceServicesService);
  private readonly router = inject(Router);

  readonly stage = signal<Stage>('loading');
  readonly services = signal<ComplianceServiceRef[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    this.api.list().subscribe({
      next: (items) => {
        if (items.length === 1) {
          this.router.navigate(['/services', items[0].id, COMPLIANCE_ROUTE], { replaceUrl: true });
          return;
        }
        this.services.set(items);
        this.stage.set(items.length === 0 ? 'empty' : 'choose');
      },
      error: (error: unknown) => this.stage.set(error instanceof HttpErrorResponse && error.status === 403 ? 'forbidden' : 'error'),
    });
  }
}
