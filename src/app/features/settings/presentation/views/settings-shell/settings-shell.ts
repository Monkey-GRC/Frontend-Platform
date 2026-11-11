import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NavigationHistoryService } from '@core/domain/services/navigation-history.service';
import { SETTINGS_GROUPS } from '@features/settings/domain/models/settings-section';

// Ajustes: una pantalla completa, sin el menú ni el encabezado de la app, para que la persona se concentre en su cuenta. Arriba, «Volver a la aplicación» (a donde estaba);
// a la izquierda, las secciones agrupadas por función; a la derecha, la sección elegida. Cada sección es una ruta hija con su URL.
@Component({
  selector: 'app-settings-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  templateUrl: './settings-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsShellView {
  private readonly router = inject(Router);
  private readonly history = inject(NavigationHistoryService);

  readonly groups = SETTINGS_GROUPS;

  back(): void {
    void this.router.navigateByUrl(this.history.returnUrl);
  }
}
