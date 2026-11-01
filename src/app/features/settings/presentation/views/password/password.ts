import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ChangePasswordCard } from '../../components/change-password-card/change-password-card';
import { SettingsDetailHeader } from '../../components/settings-detail-header/settings-detail-header';

// Detalle de «Contraseña» (D101): cambiarla cuando la persona quiera.
@Component({
  selector: 'app-password-settings',
  imports: [TranslatePipe, SettingsDetailHeader, ChangePasswordCard],
  template: `
    <app-settings-detail-header backLink="/ajustes/seguridad" [title]="'SETTINGS.SECURITY.PASSWORD.TITLE' | translate" [subtitle]="'SETTINGS.SECURITY.PASSWORD.INTRO' | translate" />
    <div class="mt-6"><app-change-password-card /></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordSettingsView {}
