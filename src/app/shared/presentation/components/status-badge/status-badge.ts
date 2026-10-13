import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Readiness, toReadiness } from '@shared/domain/models/readiness.models';

interface Look {
  icon: string;
  chip: string;
  labelKey: string;
  hintKey: string;
}

// Cuatro estados, cuatro aspectos. El color nunca va solo: cada uno lleva su propio ícono y su texto, y «Sin medir» además tiene borde
// punteado y fondo neutro para que no se confunda con «Requiere trabajo» (no es un fallo, es que todavía no hay datos).
const LOOKS: Record<Readiness, Look> = {
  ready: {
    icon: 'check_circle',
    chip: 'bg-green-50 text-green-800 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-400/30',
    labelKey: 'COMPLIANCE.STATUS.READY',
    hintKey: 'COMPLIANCE.STATUS_HINT.READY',
  },
  almost_ready: {
    icon: 'timelapse',
    chip: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-400/30',
    labelKey: 'COMPLIANCE.STATUS.ALMOST_READY',
    hintKey: 'COMPLIANCE.STATUS_HINT.ALMOST_READY',
  },
  needs_work: {
    icon: 'build_circle',
    chip: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-400/30',
    labelKey: 'COMPLIANCE.STATUS.NEEDS_WORK',
    hintKey: 'COMPLIANCE.STATUS_HINT.NEEDS_WORK',
  },
  not_measured: {
    icon: 'hourglass_empty',
    chip: 'bg-transparent text-gray-700 border border-dashed border-gray-400 dark:text-gray-300 dark:border-gray-500',
    labelKey: 'COMPLIANCE.STATUS.NOT_MEASURED',
    hintKey: 'COMPLIANCE.STATUS_HINT.NOT_MEASURED',
  },
};

// La etiqueta de estado de Cumplimiento (Preparado, Casi listo, Requiere trabajo, Sin medir). Recibe el código del backend
// (`ready`, `almost_ready`, `needs_work`, `not_measured`); un valor que no reconoce se muestra como «Sin medir», nunca como fallo.
@Component({
  selector: 'app-status-badge',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap"
      [class]="look().chip + (size() === 'sm' ? ' px-2.5 py-0.5 text-xs' : ' px-3 py-1 text-sm')"
      [attr.data-status]="level()"
      [title]="look().hintKey | translate"
    >
      <span class="material-symbols-rounded leading-none" [class]="size() === 'sm' ? 'text-[14px]' : 'text-[16px]'" aria-hidden="true">{{ look().icon }}</span>
      {{ look().labelKey | translate }}
    </span>
  `,
})
export class StatusBadge {
  readonly status = input<Readiness | string | null | undefined>('not_measured');
  readonly size = input<'sm' | 'md'>('md');

  protected readonly level = computed(() => toReadiness(this.status()));
  protected readonly look = computed(() => LOOKS[this.level()]);
}
