import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

// El rol que autorizar NO concede: «Lector global». Sin él, las verificaciones de correo no se pueden medir (y se muestran sin medir, nunca como cumplidas). Se guía aparte y se
// dice que es opcional y que se puede hacer después.
@Component({
  selector: 'app-m365-mail-access-guide',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="rounded-card border border-line p-4" aria-labelledby="m365-mail-title" data-mail-guide>
      <h3 id="m365-mail-title" class="flex items-center gap-2 text-base font-semibold text-ink">
        <span class="material-symbols-rounded text-[20px] text-action" aria-hidden="true">mail</span>
        {{ 'TECHNICAL_CONTROL.WIZARD.M365.MAIL.TITLE' | translate }}
      </h3>
      <p class="mt-2 text-sm text-ink-muted">{{ 'TECHNICAL_CONTROL.WIZARD.M365.MAIL.WHY' | translate }}</p>
      <ol class="mt-4 space-y-2 text-sm text-ink-muted">
        @for (n of steps; track n) {
          <li class="flex gap-3">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-control bg-tint-strong text-xs font-semibold text-tint-ink" aria-hidden="true">{{ n }}</span>
            <span>{{ 'TECHNICAL_CONTROL.WIZARD.M365.MAIL.STEP_' + n | translate }}</span>
          </li>
        }
      </ol>
      <a class="mk-btn-secondary mt-4 inline-flex px-3 py-2 text-xs" href="https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesManagementMenuBlade/~/AllRoles" target="_blank" rel="noopener noreferrer" data-mail-link>
        <span class="material-symbols-rounded text-[16px]" aria-hidden="true">open_in_new</span>
        {{ 'TECHNICAL_CONTROL.WIZARD.M365.MAIL.OPEN' | translate }}
      </a>
      <p class="mt-3 text-xs text-ink-faint">{{ 'TECHNICAL_CONTROL.WIZARD.M365.MAIL.LATER' | translate }}</p>
    </section>
  `,
})
export class M365MailAccessGuide {
  protected readonly steps = [1, 2, 3];
}
