import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, filter, map, of, startWith } from 'rxjs';
import { FrameworkOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { COMPLIANCE_ROUTE, COMPLIANCE_SECTIONS, COMPLIANCE_SERVICE_PARAM, ComplianceSectionPath, ComplianceServiceRef, DEFAULT_COMPLIANCE_SECTION } from '@features/compliance/domain/models/compliance.models';
import { ActiveComplianceService } from '@features/compliance/domain/services/active-compliance.service';
import { ComplianceContextService } from '@features/compliance/domain/services/compliance-context.service';
import { ComplianceServicesService } from '@features/compliance/domain/services/compliance-services.service';
import { ComplianceBanner, BannerFramework } from '../../components/compliance-banner/compliance-banner';
import { targetValue } from '@shared/presentation/utils/event-target';
import { Select, SelectOption } from '@shared/presentation/components/select/select';

// El marco de Cumplimiento: de qué servicio y de qué marco se habla y la sección abierta (MD-119). Cada sección es una página del menú (`/cumplimiento/<sección>`, sin id);
// el servicio activo se elige con el selector de este encabezado y se recuerda entre secciones (`ActiveComplianceService`). Un enlace puede fijarlo con `?servicio=<id>`.
// El cumplimiento se mide por servicio × marco y cada servicio tiene su propia copia de controles, riesgos y causas, así que el encabezado siempre dice de cuál se trata y,
// si la empresa tiene varios, deja cambiar de uno a otro sin salir de la sección. Nunca hay un total de la empresa.
@Component({
  selector: 'app-compliance-shell',
  imports: [RouterOutlet, TranslatePipe, ComplianceBanner, Select],
  templateUrl: './compliance-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceShellView implements OnInit {
  protected readonly targetValue = targetValue;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicesApi = inject(ComplianceServicesService);
  private readonly catalogs = inject(CatalogService);
  private readonly active = inject(ActiveComplianceService);
  /** Lo que el Resumen le cuenta al encabezado: el período de la evaluación y si los marcos se pueden elegir. */
  readonly context = inject(ComplianceContextService);

  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url), startWith(this.router.url)), { initialValue: this.router.url });
  /** La sección de la ruta actual (el título de la página); sin sección reconocible, el Resumen. */
  readonly section = computed(() => {
    const path = new RegExp(`/${COMPLIANCE_ROUTE}/([^/?#]+)`).exec(this.url())?.[1] as ComplianceSectionPath | undefined;
    return COMPLIANCE_SECTIONS.find((s) => s.path === path) ?? COMPLIANCE_SECTIONS.find((s) => s.path === DEFAULT_COMPLIANCE_SECTION) ?? COMPLIANCE_SECTIONS[0];
  });
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  /** El servicio activo; `null` mientras no se haya elegido ni llegado uno por enlace (hasta que la lista da el primero). */
  readonly serviceId = this.active.serviceId;

  // `null` = no se pudo leer la lista (hoy solo `admin_empresa` puede, B1): el encabezado cae al título genérico.
  readonly services = signal<ComplianceServiceRef[] | null>(null);
  // El nombre de los marcos sale del catálogo del backend (la lista de servicios solo trae el código).
  private readonly frameworks = toSignal(this.catalogs.frameworks().pipe(catchError(() => of([] as FrameworkOption[]))), { initialValue: [] as FrameworkOption[] });

  readonly current = computed(() => this.services()?.find((s) => s.id === this.serviceId()) ?? null);
  readonly bannerFrameworks = computed<BannerFramework[]>(() => (this.current()?.frameworks ?? []).map((f) => ({ code: f.code, label: this.frameworkLabel(f.code) })));
  readonly others = computed(() => this.services() ?? []);
  protected readonly GENERAL = 'general';
  protected readonly serviceOptions = computed<SelectOption[]>(() => [{ value: this.GENERAL, labelKey: 'COMPLIANCE.SHELL.GENERAL' }, ...this.others().map((s) => ({ value: s.id, label: s.name }))]);
  readonly canSwitch = computed(() => (this.services()?.length ?? 0) > 1);

  constructor() {
    // Un enlace que lleva a un servicio concreto lo manda en `?servicio=`: se fija como activo y se quita de la dirección para que no pise lo que se elija después.
    effect(() => {
      const id = this.query().get(COMPLIANCE_SERVICE_PARAM);
      if (!id) return;
      untracked(() => {
        this.active.set(id);
        this.router.navigate([], { queryParams: { [COMPLIANCE_SERVICE_PARAM]: null }, queryParamsHandling: 'merge', replaceUrl: true });
      });
    });
    // Si el encabezado muestra los marcos del servicio, el Resumen no repite sus propios botones.
    effect(() => {
      const shows = (this.current()?.frameworks.length ?? 0) > 0;
      untracked(() => this.context.headerShowsFrameworks.set(shows));
    });
    inject(DestroyRef).onDestroy(() => this.context.headerShowsFrameworks.set(false));
  }

  ngOnInit(): void {
    this.servicesApi.list().pipe(catchError(() => of(null))).subscribe((list) => {
      this.services.set(list);
      this.settleActive(list);
    });
  }

  /** Con la lista a la vista: sin servicio activo (o con uno que ya no existe) se toma el primero; sin ninguno, se vuelve a la entrada, que explica por qué no hay. */
  private settleActive(list: ComplianceServiceRef[] | null): void {
    const id = this.serviceId();
    if (list && list.length > 0 && !(id && list.some((s) => s.id === id)) && !this.query().get(COMPLIANCE_SERVICE_PARAM)) {
      this.active.set(list[0].id);
    } else if (!id && !this.query().get(COMPLIANCE_SERVICE_PARAM)) {
      this.router.navigate(['/', COMPLIANCE_ROUTE], { replaceUrl: true });
    }
  }

  /** Elegir un marco en el encabezado: solo tiene efecto en el Resumen, que es lo que lo escucha (por eso solo se puede pulsar ahí). */
  pickFramework(code: string): void {
    this.context.selected.set(code);
  }

  /** «Cambiar período»: lo abre el Resumen, que es quien tiene el marco y el formulario. */
  editPeriod(): void {
    this.context.editPeriod()?.();
  }

  frameworkLabel(code: string): string {
    return this.frameworks().find((f) => f.code === code)?.label ?? code;
  }

  /** Cambia de servicio y se queda en la misma sección; «General» vuelve a la vista de todos los servicios. */
  switchTo(serviceId: string): void {
    if (!serviceId || serviceId === this.serviceId()) return;
    // «General»: cómo va cada servicio en cada marco.
    if (serviceId === this.GENERAL) {
      this.router.navigate(['/', COMPLIANCE_ROUTE]);
      return;
    }
    this.active.set(serviceId);
  }
}
