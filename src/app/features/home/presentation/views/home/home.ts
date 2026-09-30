import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '@core/domain/services/session.service';

// Pantalla de llegada tras activar la cuenta o iniciar sesión. Es provisional: el dashboard de
// 4 preguntas la reemplaza. Sin jerga ni porcentajes, como pide philosophy.md.
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  readonly session = inject(SessionService);

  // El backend dice en qué paso va el cliente; aquí solo se traduce a una invitación clara.
  readonly pendingCompanyContext = computed(
    () => this.session.onboarding()?.next_step === 'organizational_context',
  );
}
