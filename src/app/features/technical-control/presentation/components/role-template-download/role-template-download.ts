import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { Busy } from '@shared/presentation/directives/busy';

// El botón que descarga la plantilla del rol de solo lectura de AWS (D58). Si falla, lo dice junto al botón.
@Component({
  selector: 'app-role-template-download',
  imports: [TranslatePipe, Busy],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" (click)="download()" [disabled]="disabled()" [appBusy]="downloading()" data-download class="mk-btn-secondary">
      <span class="material-symbols-rounded text-[18px]" aria-hidden="true">download</span>
      {{ 'TECHNICAL_CONTROL.PANEL.DOWNLOAD' | translate }}
    </button>
    @if (error(); as e) {
      <p class="mt-2 text-xs text-bad-ink" role="alert" data-download-error>{{ e }}</p>
    }
  `,
})
export class RoleTemplateDownload {
  private readonly api = inject(TechnicalControlService);
  private readonly translate = inject(TranslateService);

  readonly disabled = input(false);
  readonly downloading = signal(false);
  readonly error = signal<string | null>(null);

  download(): void {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.error.set(null);
    this.api.downloadRoleTemplate().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'RoleMonkeyReadOnly.yaml';
        link.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: (error) => {
        this.downloading.set(false);
        this.error.set(apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.PANEL.DOWNLOAD_ERROR')));
      },
    });
  }
}
