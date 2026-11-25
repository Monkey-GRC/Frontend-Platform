import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { LanguageService } from '@core/domain/services/language.service';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Switch } from '@shared/presentation/components/switch/switch';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { NotificationPreferences } from '@features/notifications/domain/models/notification.models';
import { NotificationService } from '@features/notifications/domain/services/notification.service';
import { digestLocalTime } from '@features/notifications/domain/utils/digest-time';

type Stage = 'loading' | 'ready' | 'error';

// Ajustes → Notificaciones (D143, MD-515): el interruptor del resumen diario por correo, con la hora a la que sale, y el aviso de que los avisos de la campana no se apagan.
// El interruptor es `app-switch` (del sistema de diseño): cambia al instante, queda ocupado mientras viaja y vuelve atrás si el servidor no lo acepta.
@Component({
  selector: 'app-notification-preferences',
  imports: [TranslatePipe, Skeleton, SkeletonRegion, StatusIndicator, Switch],
  templateUrl: './notification-preferences.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPreferencesView {
  private readonly api = inject(NotificationService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stage = signal<Stage>('loading');
  readonly preferences = signal<NotificationPreferences | null>(null);
  readonly saving = signal(false);

  readonly enabled = computed(() => this.preferences()?.is_email_digest_enabled ?? false);
  readonly utcTime = computed(() => this.preferences()?.email_digest_time_utc ?? '');
  readonly localTime = computed(() => digestLocalTime(this.utcTime(), this.language.current(), new Date()));

  constructor() {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    this.api
      .preferences()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (prefs) => {
          this.preferences.set(prefs);
          this.stage.set('ready');
        },
        error: () => this.stage.set('error'),
      });
  }

  toggle(enabled: boolean): void {
    const before = this.preferences();
    if (!before || this.saving() || before.is_email_digest_enabled === enabled) return;
    this.preferences.set({ ...before, is_email_digest_enabled: enabled });
    this.saving.set(true);
    this.api
      .setDigest(enabled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (prefs) => {
          this.preferences.set(prefs);
          this.saving.set(false);
          this.toast.showSuccess(this.translate.instant(enabled ? 'NOTIFICATIONS.SETTINGS.SAVED_ON' : 'NOTIFICATIONS.SETTINGS.SAVED_OFF'), '');
        },
        error: (error) => {
          this.preferences.set(before);
          this.saving.set(false);
          this.toast.showError(this.translate.instant('NOTIFICATIONS.SETTINGS.ERROR_TITLE'), apiErrorMessage(error, this.translate.instant('NOTIFICATIONS.SETTINGS.ERROR_FALLBACK')));
        },
      });
  }
}
