import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SessionService } from '@core/domain/services/session.service';
import { isAssignedRole, isCompanyAdmin } from '@shared/domain/utils/roles';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { ComplianceGeneral } from '../../components/compliance-general/compliance-general';
import { COMPLIANCE_ROUTE, COMPLIANCE_SERVICE_PARAM, ComplianceServiceRef, DEFAULT_COMPLIANCE_SECTION } from '@features/compliance/domain/models/compliance.models';
import { ComplianceServicesService } from '@features/compliance/domain/services/compliance-services.service';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';

type Stage = 'loading' | 'error' | 'forbidden' | 'empty' | 'choose';

// Entrada del menú «Cumplimiento». El módulo vive dentro de cada servicio, así que desde aquí se llega a uno:
// con un solo servicio se entra directo; con varios, se ve el General: cómo va cada servicio en cada marco.
@Component({
  selector: 'app-compliance-entry',
  imports: [RouterLink, TranslatePipe, EmptyState, ComplianceGeneral, Skeleton, SkeletonRegion],
  templateUrl: './compliance-entry.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceEntryView implements OnInit {
  private readonly api = inject(ComplianceServicesService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  /** Solo el administrador crea servicios: al responsable, al delegado y al auditor un servicio vacío no les pide crear nada (D96). */
  readonly role = computed(() => this.session.user()?.role ?? null);
  readonly isAdminRole = computed(() => isCompanyAdmin(this.role()));
  /** El responsable y el delegado ven solo lo que se les asignó (D102). */
  readonly isAssignedRole = computed(() => isAssignedRole(this.role()));

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
          this.router.navigate(['/', COMPLIANCE_ROUTE, DEFAULT_COMPLIANCE_SECTION], { queryParams: { [COMPLIANCE_SERVICE_PARAM]: items[0].id }, replaceUrl: true });
          return;
        }
        this.services.set(items);
        this.stage.set(items.length === 0 ? 'empty' : 'choose');
      },
      error: (error: unknown) => this.stage.set(error instanceof HttpErrorResponse && error.status === 403 ? 'forbidden' : 'error'),
    });
  }
}
