import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type RingTone = 'green' | 'amber' | 'red' | 'gray';

const STROKE: Record<RingTone, string> = {
  green: 'stroke-green-600 dark:stroke-green-400',
  amber: 'stroke-amber-500 dark:stroke-amber-400',
  red: 'stroke-red-600 dark:stroke-red-400',
  gray: 'stroke-gray-400 dark:stroke-gray-500',
};

// Un anillo con un porcentaje en el centro. El texto del centro lo pone quien lo usa (ya formateado y en el idioma de la sesión): sin total no hay porcentaje y el
// anillo queda vacío con «—». El color nunca va solo: el estado se dice también con texto fuera del anillo.
@Component({
  selector: 'app-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-flex items-center justify-center" [style.width.px]="size()" [style.height.px]="size()" role="img" [attr.aria-label]="ariaLabel()">
      <svg viewBox="0 0 100 100" class="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" [attr.r]="radius" fill="none" stroke-width="9" class="stroke-gray-200 dark:stroke-gray-700" />
        <circle cx="50" cy="50" [attr.r]="radius" fill="none" stroke-width="9" stroke-linecap="round" [class]="stroke()" [attr.stroke-dasharray]="dash()" />
      </svg>
      <span class="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
        <span class="font-semibold text-gray-900 dark:text-white" [class]="size() >= 110 ? 'text-2xl' : 'text-base'">{{ text() }}</span>
        @if (caption(); as c) {<span class="text-[11px] text-gray-600 dark:text-gray-300">{{ c }}</span>}
      </span>
    </div>
  `,
})
export class ProgressRing {
  /** 0–100, o `null` sin total. */
  readonly value = input<number | null>(null);
  /** Lo que se escribe en el centro (ya formateado). */
  readonly text = input('—');
  readonly caption = input<string | null>(null);
  readonly tone = input<RingTone>('gray');
  readonly size = input(96);
  readonly ariaLabel = input('');

  protected readonly radius = RADIUS;
  protected readonly stroke = computed(() => STROKE[this.tone()]);
  protected readonly dash = computed(() => {
    const filled = ((this.value() ?? 0) / 100) * CIRCUMFERENCE;
    return `${filled} ${CIRCUMFERENCE}`;
  });
}
