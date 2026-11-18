import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { SecurityService } from '@features/settings/domain/services/security.service';
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
  readonly devicesLink = '/ajustes/seguridad/dispositivos';

  // Cuántos dispositivos recordados siguen vigentes; null mientras carga o si no se pudo saber (la fila sigue siendo un enlace).
  readonly deviceCount = signal<number | null>(null);

  constructor() {
    inject(SecurityService).listDevices().pipe(takeUntilDestroyed()).subscribe({ next: (list) => this.deviceCount.set(list.length), error: () => this.deviceCount.set(null) });
  }
}
