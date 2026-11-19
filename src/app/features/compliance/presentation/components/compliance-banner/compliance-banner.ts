import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ComplianceInsight } from '@features/compliance/domain/services/compliance-context.service';

export interface BannerFramework {
  code: string;
  label: string;
}

/**
 * The banner of the Compliance shell: the ONLY banner with a background the design system allows (README, section 2). It tells which section is open, of which service
 * and framework, over which period, and gives one short line of context that the section already has loaded. It carries no icons and no back link.
 * Dumb: it shows what it is given; the service selector comes in the `[actions]` slot and «Change period» is an output.
 *
 *   <app-compliance-banner eyebrow="…" [title]="…" [service]="…" [frameworks]="…" [period]="…" [insight]="…">
 *     <div actions>…</div>
 *   </app-compliance-banner>
 */
@Component({
  selector: 'app-compliance-banner',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <header class="mk-banner px-5 py-4 sm:px-6 sm:py-5" data-compliance-banner>
      <div class="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div class="min-w-0">
          <p class="text-xs font-semibold" data-banner-eyebrow>{{ eyebrow() }}</p>
          <h1 class="mt-1 truncate text-3xl font-semibold leading-tight">{{ title() }}</h1>
          @if (service() || frameworks().length) {
            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              @if (service(); as name) {
                <p class="min-w-0 truncate text-lg font-medium" data-banner-service>{{ name }}</p>
              }
              @if (frameworks().length) {
                <ul class="flex flex-wrap items-center gap-2" [attr.aria-label]="frameworksLabel()">
                  @for (f of frameworks(); track f.code) {
                    <li>
                      @if (selectable()) {
                        <button type="button" (click)="frameworkPick.emit(f.code)" [attr.aria-pressed]="f.code === selected()" [attr.data-framework-pick]="f.code"
                          class="rounded-control border px-2.5 py-0.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                          [class]="f.code === selected() ? 'border-white bg-white text-brand-700' : 'border-white/60 text-white hover:bg-white/15'">{{ f.label }}</button>
                      } @else {
                        <span class="inline-block rounded-control border border-white/60 px-2.5 py-0.5 text-xs font-semibold" data-banner-framework>{{ f.label }}</span>
                      }
                    </li>
                  }
                </ul>
              }
            </div>
          }
        </div>
        <div class="flex shrink-0 items-center gap-2"><ng-content select="[actions]" /></div>
      </div>

      @if (insight() || period()) {
        <div class="relative mt-4 flex flex-col gap-1 border-t border-white/25 pt-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6">
          @if (insight(); as line) {
            <p class="min-w-0" data-banner-insight>
              @if (line.kind === 'status') {
                <strong class="font-semibold">{{ line.statusKey | translate }}</strong> · {{ line.hintKey | translate }}
              } @else {
                {{ line.labelKey | translate: { count: line.count } }}
              }
            </p>
          }
          @if (period(); as text) {
            <p class="flex flex-wrap items-center gap-x-3" data-banner-period>
              <span>{{ text }}</span>
              @if (canEditPeriod()) {
                <button type="button" (click)="periodEdit.emit()" data-edit-period
                  class="rounded-control font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{{ 'COMPLIANCE.PERIOD.EDIT' | translate }}</button>
              }
            </p>
          }
        </div>
      }
    </header>
  `,
})
export class ComplianceBanner {
  /** Already translated: «Compliance». */
  readonly eyebrow = input.required<string>();
  /** The open section (Summary, Risks…), already translated. */
  readonly title = input.required<string>();
  readonly service = input<string | null>(null);
  readonly frameworks = input<BannerFramework[]>([]);
  /** With several frameworks the summary lets one be chosen from here. */
  readonly selectable = input(false);
  readonly selected = input<string | null>(null);
  readonly frameworksLabel = input<string | null>(null);
  /** The period of the evaluation, already written for the language; nothing when it is not defined. */
  readonly period = input<string | null>(null);
  readonly canEditPeriod = input(false);
  readonly insight = input<ComplianceInsight | null>(null);

  readonly frameworkPick = output<string>();
  readonly periodEdit = output<void>();
}
