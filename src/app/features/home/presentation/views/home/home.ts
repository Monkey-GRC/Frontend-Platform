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

  // D89 · El onboarding es solo el contexto de la empresa. Declarar servicios y conectar activos ya no son pasos del onboarding: se hacen cuando el cliente quiera,
  // desde «Mis servicios» o desde Cumplimiento. El backend sigue listando esos pasos en `completed_steps`/`next_step`, pero aquí solo importa el primero.
  readonly nextStep = computed(() => this.session.onboarding()?.next_step ?? null);
  readonly pendingCompanyContext = computed(() => this.nextStep() === 'organizational_context');
  /** Con el contexto de la empresa declarado ya no se le dice que «su cuenta está activa»: se le da la bienvenida a su resumen. */
  /** Un funcional o un auditor no administra la empresa: su inicio los lleva directo a Cumplimiento, donde está lo suyo (D97). */
  readonly role = computed(() => this.session.user()?.role ?? null);
  readonly isWorker = computed(() => this.role() === 'funcional' || this.role() === 'auditor');
  readonly onboarded = computed(() => this.session.onboarding() !== null && !this.pendingCompanyContext());
}
