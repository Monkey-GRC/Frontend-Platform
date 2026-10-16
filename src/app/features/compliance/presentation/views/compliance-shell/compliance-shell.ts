import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { FrameworkOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { COMPLIANCE_ROUTE, COMPLIANCE_TABS, ComplianceServiceRef, DEFAULT_COMPLIANCE_TAB } from '../../../domain/models/compliance.models';
import { ComplianceServicesService } from '../../../domain/services/compliance-services.service';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';

// El marco de Cumplimiento dentro de un servicio: de qué servicio se habla, las pestañas y la vista de la pestaña activa (MD-119). El cumplimiento se mide
// por servicio × marco y cada servicio tiene su propia copia de controles, riesgos y causas, así que el encabezado siempre dice de cuál se trata y, si la
// empresa tiene varios, deja cambiar de uno a otro sin salir de la pestaña. Nunca hay un total de la empresa.
@Component({
  selector: 'app-compliance-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  templateUrl: './compliance-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceShellView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicesApi = inject(ComplianceServicesService);
  private readonly catalogs = inject(CatalogService);
  readonly view = inject(ComplianceViewService);

  readonly tabs = COMPLIANCE_TABS;
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly serviceId = computed(() => this.params().get('id') ?? '');

  // `null` = no se pudo leer la lista (hoy solo `admin_empresa` puede, B1): el encabezado cae al título genérico.
  readonly services = signal<ComplianceServiceRef[] | null>(null);
  // El nombre de los marcos sale del catálogo del backend (la lista de servicios solo trae el código).
  private readonly frameworks = toSignal(this.catalogs.frameworks().pipe(catchError(() => of([] as FrameworkOption[]))), { initialValue: [] as FrameworkOption[] });

  readonly current = computed(() => this.services()?.find((s) => s.id === this.serviceId()) ?? null);
  readonly others = computed(() => this.services() ?? []);
  readonly canSwitch = computed(() => (this.services()?.length ?? 0) > 1);

  ngOnInit(): void {
    this.servicesApi.list().pipe(catchError(() => of(null))).subscribe((list) => this.services.set(list));
  }

  frameworkLabel(code: string): string {
    return this.frameworks().find((f) => f.code === code)?.label ?? code;
  }

  /** Cambia de servicio y se queda en la misma pestaña. */
  switchTo(serviceId: string): void {
    if (!serviceId || serviceId === this.serviceId()) return;
    const tab = new RegExp(`/${COMPLIANCE_ROUTE}/([^/?#]+)`).exec(this.router.url)?.[1] ?? DEFAULT_COMPLIANCE_TAB;
    this.router.navigate(['/services', serviceId, COMPLIANCE_ROUTE, tab]);
  }
}
