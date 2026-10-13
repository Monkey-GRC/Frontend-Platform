import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="language.toggle()"
      [title]="'SHELL.LANGUAGE.SWITCH' | translate"
      [attr.aria-label]="'SHELL.LANGUAGE.SWITCH' | translate"
      class="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
    >
      <span class="material-symbols-outlined text-xl">translate</span>
      <span>{{ language.current() === 'es' ? 'ES' : 'EN' }}</span>
    </button>
  `,
})
export class LanguageToggleComponent {
  protected readonly language = inject(LanguageService);
}
