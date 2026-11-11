import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { SettingsGroup } from '../../components/settings-group/settings-group';
import { SettingsRow } from '../../components/settings-row/settings-row';

// Seguridad de la cuenta (SEG-14, SEG-16): el resumen. Cada categoría reúne sus opciones; las que tienen «>» abren su propia pantalla.
@Component({
  selector: 'app-security',
  imports: [TranslatePipe, SettingsGroup, SettingsRow, StatusIndicator],
  templateUrl: './security.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityView {
  readonly passwordLink = '/ajustes/seguridad/contrasena';
  readonly recoveryLink = '/ajustes/seguridad/codigos-de-recuperacion';
}
