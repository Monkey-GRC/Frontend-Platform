import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { SecondFactorAnswer, SecondFactorDialog } from '@shared/presentation/components/second-factor-dialog/second-factor-dialog';
import { SecurityService } from '@features/settings/domain/services/security.service';

// Códigos de recuperación del segundo factor (D94, SEG-16): generar 10 nuevos exige un código vigente de la app (se pide en un modal) y los anteriores dejan de servir.
// Se muestran una sola vez.
@Component({
  selector: 'app-recovery-codes-card',
  imports: [TranslatePipe, SecondFactorDialog],
  templateUrl: './recovery-codes-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoveryCodesCard {
  private readonly security = inject(SecurityService);
  private readonly translate = inject(TranslateService);

  readonly asking = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly recoveryCodes = signal<string[]>([]);
  readonly saved = signal(false);
  readonly copied = signal(false);

  start(): void {
    this.errorMessage.set(null);
    this.asking.set(true);
  }

  cancel(): void {
    if (this.loading()) return;
    this.asking.set(false);
    this.errorMessage.set(null);
  }

  generate(factor: SecondFactorAnswer): void {
    if (this.loading() || !factor.code) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.security.regenerateRecoveryCodes(factor.code).subscribe({
      next: (codes) => {
        this.loading.set(false);
        this.asking.set(false);
        this.recoveryCodes.set(codes);
        this.saved.set(false);
        this.copied.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(apiErrorMessage(error, this.translate.instant('SETTINGS.SECURITY.RECOVERY.ERROR_FALLBACK')));
      },
    });
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.recoveryCodes().join('\n'));
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  // Cerrar la lista las borra de la pantalla: no se pueden volver a ver.
  dismiss(): void {
    this.recoveryCodes.set([]);
    this.copied.set(false);
  }
}
