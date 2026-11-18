import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { LanguageService } from '@core/domain/services/language.service';
import { RememberedDevice } from '@features/settings/domain/models/security.models';
import { DeviceGroup, groupDevices } from '@features/settings/domain/utils/device-groups';
import { SecurityService } from '@features/settings/domain/services/security.service';
import { DeviceIcon } from '@shared/presentation/components/device-icon/device-icon';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/presentation/components/empty-state/empty-state';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { LocalDatePipe } from '@shared/presentation/pipes/local-date.pipe';
import { SettingsDetailHeader } from '../../components/settings-detail-header/settings-detail-header';

type Loading = 'loading' | 'ready' | 'error';
// Qué se está por olvidar: un dispositivo o todos.
type Pending = { kind: 'one'; device: RememberedDevice } | { kind: 'all' };

// Detalle de «Dispositivos recordados» (D123, SEG-84): los navegadores donde no se pide el código del segundo factor; cada uno se puede olvidar.
@Component({
  selector: 'app-devices-settings',
  imports: [TranslatePipe, LocalDatePipe, SettingsDetailHeader, ConfirmDialog, DeviceIcon, EmptyState, Skeleton, SkeletonRegion, StatusIndicator],
  templateUrl: './devices.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicesSettingsView {
  private readonly destroyRef = inject(DestroyRef);
  private readonly security = inject(SecurityService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly state = signal<Loading>('loading');
  readonly devices = signal<RememberedDevice[]>([]);
  readonly groups = computed(() => groupDevices(this.devices()));
  readonly pending = signal<Pending | null>(null);
  readonly working = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.security.listDevices().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => {
        this.devices.set(list);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }

  name(device: RememberedDevice): string {
    const { browser, os } = device;
    if (browser && os) return this.translate.instant('SETTINGS.SECURITY.DEVICES.NAME', { browser, os });
    return browser ?? os ?? this.translate.instant('SETTINGS.SECURITY.DEVICES.UNKNOWN');
  }

  groupTitle(group: DeviceGroup): string {
    const base = 'SETTINGS.SECURITY.DEVICES.';
    if (!group.type && !group.os) return this.translate.instant(base + 'UNKNOWN');
    const type = this.translate.instant(base + 'TYPE_' + (group.type ?? 'unknown').toUpperCase());
    const os = group.os ?? this.translate.instant(base + 'OS_UNKNOWN');
    return this.translate.instant(base + 'GROUP_TITLE', { type, os });
  }

  groupCount(group: DeviceGroup): string {
    const count = group.devices.length;
    return this.translate.instant(count === 1 ? 'SETTINGS.SECURITY.DEVICES.COUNT_ONE' : 'SETTINGS.SECURITY.DEVICES.COUNT_OTHER', { count });
  }

  browserName(device: RememberedDevice): string {
    return device.browser ?? this.translate.instant('SETTINGS.SECURITY.DEVICES.BROWSER_UNKNOWN');
  }

  location(device: RememberedDevice): string {
    const country = this.countryName(device.country);
    const parts = [device.city, country].filter((part): part is string => !!part);
    return parts.length ? parts.join(', ') : this.translate.instant('SETTINGS.SECURITY.DEVICES.LOCATION_UNKNOWN');
  }

  private countryName(code: string | null): string | null {
    if (!code) return null;
    try {
      return new Intl.DisplayNames([this.language.current()], { type: 'region' }).of(code.toUpperCase()) ?? code;
    } catch {
      return code;
    }
  }

  askOne(device: RememberedDevice): void {
    this.pending.set({ kind: 'one', device });
  }

  askAll(): void {
    this.pending.set({ kind: 'all' });
  }

  cancel(): void {
    if (!this.working()) this.pending.set(null);
  }

  confirm(): void {
    const target = this.pending();
    if (!target || this.working()) return;
    this.working.set(true);
    const forgotCurrent = target.kind === 'all' || target.device.is_current;
    const request = target.kind === 'all' ? this.security.forgetAllDevices() : this.security.forgetDevice(target.device.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.done(forgotCurrent),
      error: (error) => {
        this.working.set(false);
        this.pending.set(null);
        this.toast.showError(this.translate.instant('SETTINGS.SECURITY.DEVICES.ERROR_TITLE'), apiErrorMessage(error, this.translate.instant('SETTINGS.SECURITY.DEVICES.ERROR_FALLBACK')));
        // «No encontrado»: ya no estaba vigente; la lista se pone al día.
        this.load();
      },
    });
  }

  private done(forgotCurrent: boolean): void {
    this.working.set(false);
    this.pending.set(null);
    this.toast.showSuccess(
      this.translate.instant('SETTINGS.SECURITY.DEVICES.FORGOTTEN'),
      forgotCurrent ? this.translate.instant('SETTINGS.SECURITY.DEVICES.FORGOTTEN_CURRENT') : '',
    );
    this.load();
  }
}
