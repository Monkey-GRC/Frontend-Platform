import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { COMPLIANCE_TABS } from '../../../domain/models/compliance.models';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';

// El marco de Cumplimiento dentro de un servicio: título, pestañas y la vista de la pestaña activa (MD-119).
// Cada pestaña es una ruta hija (resumen · acciones · riesgos · evidencias) que rellena su propia historia.
@Component({
  selector: 'app-compliance-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  templateUrl: './compliance-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceShellView {
  private readonly route = inject(ActivatedRoute);
  readonly view = inject(ComplianceViewService);

  readonly tabs = COMPLIANCE_TABS;
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly serviceId = computed(() => this.params().get('id') ?? '');
}
