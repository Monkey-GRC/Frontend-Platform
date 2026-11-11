import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, model, signal, untracked, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';

/** Un día del calendario. `iso` es `AAAA-MM-DD`. */
interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
  disabled: boolean;
  today: boolean;
  selected: boolean;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number): string => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number): string => `${y}-${pad(m + 1)}-${pad(d)}`;
/** Las fechas se manejan como texto `AAAA-MM-DD` y los cálculos van en UTC: así un día nunca se corre por la zona horaria. */
const parse = (iso: string): { y: number; m: number; d: number } | null => {
  if (!ISO.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? { y, m: m - 1, d } : null;
};
const addDays = (iso: string, days: number): string => {
  const p = parse(iso);
  if (!p) return iso;
  const date = new Date(Date.UTC(p.y, p.m, p.d + days));
  return toIso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

// Selector de un día con calendario: se abre al tocar el campo, se elige el día y se cierra. Nadie tiene que escribir la fecha (aunque sí puede moverse con el teclado:
// flechas ±1 día y ±1 semana, Re Pág / Av Pág cambian de mes, Enter elige, Esc cierra). El valor es `AAAA-MM-DD` o vacío; `min` y `max` deshabilitan los días de fuera.
// Los nombres de meses y días salen del idioma de la app. En pantallas angostas se abre como una hoja desde abajo.
@Component({
  selector: 'app-date-picker',
  imports: [TranslatePipe],
  templateUrl: './date-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'close()', '(window:resize)': 'close()' },
})
export class DatePicker {
  private readonly language = inject(LanguageService);

  /** El día elegido (`AAAA-MM-DD`) o vacío. */
  readonly value = model('');
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly disabled = input(false);
  readonly inputId = input('date-picker');
  readonly placeholderKey = input('COMMON.DATE_PICKER.PLACEHOLDER');
  readonly invalid = input(false);

  readonly open = signal(false);
  /** Qué se está eligiendo: el día (por defecto), el mes o el año. El título del calendario lleva de uno a otro: así se llega a cualquier año sin dar cien clics. */
  readonly mode = signal<'days' | 'months' | 'years'>('days');
  private readonly yearPage = signal(0);
  /** El día con el foco del teclado dentro del calendario. */
  readonly focused = signal('');
  private readonly view = signal({ y: 0, m: 0 });
  /** Dónde se pinta el calendario en pantallas anchas (posición fija: el panel que lo contiene puede recortarlo). */
  readonly position = signal<{ top: number; left: number } | null>(null);

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');

  readonly today = computed(() => new Date().toISOString().slice(0, 10));
  private readonly locale = computed(() => this.language.current());

  readonly label = computed(() => {
    const p = parse(this.value());
    return p ? new Intl.DateTimeFormat(this.locale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(p.y, p.m, p.d))) : '';
  });
  readonly monthLabel = computed(() => {
    const { y, m } = this.view();
    const text = new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1)));
    return text.charAt(0).toUpperCase() + text.slice(1);
  });
  /** Lunes a domingo, en el idioma de la app. */
  readonly weekdays = computed(() => {
    const fmt = new Intl.DateTimeFormat(this.locale(), { weekday: 'short', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))).replace('.', ''));
  });
  /** Seis semanas, de lunes a domingo, con los días de los meses vecinos atenuados. */
  readonly weeks = computed<Cell[][]>(() => {
    const { y, m } = this.view();
    const first = new Date(Date.UTC(y, m, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const start = addDays(toIso(y, m, 1), -offset);
    const selected = this.value();
    const today = this.today();
    const min = this.min();
    const max = this.max();
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const iso = addDays(start, w * 7 + d);
        return { iso, day: Number(iso.slice(8)), inMonth: Number(iso.slice(5, 7)) - 1 === m, disabled: (!!min && iso < min) || (!!max && iso > max), today: iso === today, selected: iso === selected };
      }),
    );
  });
  /** Doce años por página; el de la fecha elegida queda en la página. */
  readonly years = computed(() => {
    const min = this.min();
    const max = this.max();
    return Array.from({ length: 12 }, (_, i) => {
      const year = this.yearPage() + i;
      return { year, current: year === this.view().y, today: String(year) === this.today().slice(0, 4), disabled: (!!min && year < Number(min.slice(0, 4))) || (!!max && year > Number(max.slice(0, 4))) };
    });
  });
  readonly months = computed(() => {
    const { y } = this.view();
    const fmt = new Intl.DateTimeFormat(this.locale(), { month: 'short', timeZone: 'UTC' });
    const min = this.min();
    const max = this.max();
    return Array.from({ length: 12 }, (_, m) => {
      const label = fmt.format(new Date(Date.UTC(y, m, 1))).replace('.', '');
      const first = toIso(y, m, 1);
      const last = toIso(y, m, new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
      return { m, label: label.charAt(0).toUpperCase() + label.slice(1), current: m === this.view().m, disabled: (!!min && last < min) || (!!max && first > max) };
    });
  });
  /** Lo que dice el título según lo que se elige. */
  readonly headerLabel = computed(() => {
    if (this.mode() === 'days') return this.monthLabel();
    if (this.mode() === 'months') return String(this.view().y);
    return `${this.yearPage()} – ${this.yearPage() + 11}`;
  });
  readonly canGoToday = computed(() => {
    const today = this.today();
    const min = this.min();
    const max = this.max();
    return (!min || today >= min) && (!max || today <= max);
  });

  constructor() {
    // Al abrir se muestra el mes del día elegido (o el de hoy) y el foco empieza en ese día.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        const start = parse(this.value()) ?? parse(this.today());
        if (!start) return;
        this.view.set({ y: start.y, m: start.m });
        this.mode.set('days');
        this.focused.set(toIso(start.y, start.m, start.d));
      });
    });
  }

  toggle(): void {
    if (this.disabled()) return;
    if (this.open()) return this.close();
    const rect = this.trigger()?.nativeElement.getBoundingClientRect();
    // En pantallas angostas el calendario es una hoja desde abajo (sin posición); en las anchas, justo debajo del campo, o encima si abajo no cabe.
    if (rect && window.innerWidth >= 640) {
      const height = 360;
      const below = rect.bottom + 6;
      this.position.set({ top: below + height > window.innerHeight && rect.top > height ? rect.top - height - 6 : below, left: Math.min(rect.left, Math.max(8, window.innerWidth - 304)) });
    } else {
      this.position.set(null);
    }
    this.open.set(true);
    setTimeout(() => this.focusDay());
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
  }

  pick(cell: Cell): void {
    if (cell.disabled) return;
    this.value.set(cell.iso);
    this.close();
  }

  clear(): void {
    this.value.set('');
    this.close();
  }

  selectToday(): void {
    if (!this.canGoToday()) return;
    this.value.set(this.today());
    this.close();
  }

  /** El título: del día se pasa a los años; del mes, también; de los años se vuelve a los días. */
  titleClick(): void {
    if (this.mode() === 'years') {
      this.mode.set('days');
      setTimeout(() => this.focusDay());
      return;
    }
    this.yearPage.set(this.view().y - 5);
    this.mode.set('years');
  }

  /** Las flechas del encabezado mueven lo que se está viendo: un mes, un año o una página de doce años. */
  shift(delta: number): void {
    if (this.mode() === 'days') return this.shiftMonth(delta);
    if (this.mode() === 'months') return this.view.update((v) => ({ ...v, y: v.y + delta }));
    this.yearPage.update((p) => p + 12 * delta);
  }

  pickYear(year: number, disabled: boolean): void {
    if (disabled) return;
    this.view.update((v) => ({ ...v, y: year }));
    this.mode.set('months');
  }

  pickMonth(month: number, disabled: boolean): void {
    if (disabled) return;
    const { y } = this.view();
    this.view.set({ y, m: month });
    // El foco queda en el mismo día del mes nuevo (o en el último si no existe).
    const day = parse(this.focused())?.d ?? 1;
    const last = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
    this.focused.set(toIso(y, month, Math.min(day, last)));
    this.mode.set('days');
    setTimeout(() => this.focusDay());
  }

  shiftMonth(delta: number): void {
    const { y, m } = this.view();
    const date = new Date(Date.UTC(y, m + delta, 1));
    this.view.set({ y: date.getUTCFullYear(), m: date.getUTCMonth() });
    // El foco se queda en el mismo día del mes nuevo (o en el último si no existe).
    const f = parse(this.focused()) ?? { d: 1 };
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    this.focused.set(toIso(date.getUTCFullYear(), date.getUTCMonth(), Math.min(f.d, last)));
  }

  /** Flechas: ±1 día / ±1 semana. Re Pág y Av Pág: mes anterior y siguiente. Inicio y Fin: lunes y domingo de la semana. */
  onKey(event: KeyboardEvent): void {
    const f = this.focused();
    if (!f || this.mode() !== 'days') return;
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in steps) {
      event.preventDefault();
      this.moveFocus(addDays(f, steps[event.key]));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      this.shiftMonth(event.key === 'PageUp' ? -1 : 1);
      setTimeout(() => this.focusDay());
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const dow = (new Date(`${f}T00:00:00Z`).getUTCDay() + 6) % 7;
      this.moveFocus(addDays(f, event.key === 'Home' ? -dow : 6 - dow));
    }
  }

  private moveFocus(iso: string): void {
    const p = parse(iso);
    if (!p) return;
    this.focused.set(iso);
    if (p.y !== this.view().y || p.m !== this.view().m) this.view.set({ y: p.y, m: p.m });
    setTimeout(() => this.focusDay());
  }

  private focusDay(): void {
    this.grid()?.nativeElement.querySelector<HTMLElement>('[data-day][tabindex="0"]')?.focus();
  }
}
