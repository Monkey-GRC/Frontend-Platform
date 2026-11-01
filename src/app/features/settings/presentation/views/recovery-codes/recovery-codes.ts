import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RecoveryCodesCard } from '../../components/recovery-codes-card/recovery-codes-card';
import { SettingsDetailHeader } from '../../components/settings-detail-header/settings-detail-header';

// Detalle de «Códigos de recuperación» (D94, SEG-16): generar códigos nuevos.
@Component({
  selector: 'app-recovery-codes-settings',
  imports: [TranslatePipe, SettingsDetailHeader, RecoveryCodesCard],
  template: `
    <app-settings-detail-header backLink="/ajustes/seguridad" [title]="'SETTINGS.SECURITY.RECOVERY.TITLE' | translate" [subtitle]="'SETTINGS.SECURITY.RECOVERY.INTRO' | translate" />
    <div class="mt-6"><app-recovery-codes-card /></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoveryCodesSettingsView {}
