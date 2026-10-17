import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SessionService } from '@core/domain/services/session.service';
import { CompanyDashboard } from '../../components/company-dashboard/company-dashboard';

// Pantalla de llegada tras activar la cuenta o iniciar sesión. Es provisional: el dashboard de
// 4 preguntas la reemplaza. Sin jerga ni porcentajes, como pide philosophy.md.
@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslatePipe, CompanyDashboard],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  readonly session = inject(SessionService);

  // El backend dice en qué paso va el cliente; aquí solo se traduce a una invitación clara.
  readonly nextStep = computed(() => this.session.onboarding()?.next_step ?? null);
  readonly pendingCompanyContext = computed(() => this.nextStep() === 'organizational_context');
  readonly pendingService = computed(() => this.nextStep() === 'service_context');
  readonly pendingTechnicalControl = computed(() => this.nextStep() === 'technical_control');
}
