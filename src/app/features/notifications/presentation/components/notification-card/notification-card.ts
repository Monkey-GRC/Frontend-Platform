import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Tag } from '@shared/presentation/components/tag/tag';
import { UnreadDot } from '@shared/presentation/components/unread-dot/unread-dot';
import { NotificationItem } from '@features/notifications/domain/models/notification.models';
import { NotificationLink } from '@features/notifications/domain/utils/notification-link';
import { NoticeTone, cardCodes, noticeAppearance } from '@features/notifications/domain/utils/notification-appearance';
import { titleParts } from '@features/notifications/domain/utils/notification-panel';

// Cada clase completa: Tailwind no ve las que se arman con piezas.
const TONE_CLASS: Record<NoticeTone, string> = {
  ok: 'mk-metric-icon-ok',
  warn: 'mk-metric-icon-warn',
  bad: 'mk-metric-icon-bad',
  neutral: 'mk-metric-icon-neutral',
  info: 'mk-metric-icon-data-1',
};

let nextCardId = 0;

/**
 * La tarjeta de un aviso, la misma en la campana y el centro (MD-508): a la izquierda el ícono de su tipo en un círculo del tono del aviso; a la derecha, arriba,
 * «servicio · hace cuánto» con el punto de no leído al extremo; el título en negrita (sin el código del control, que va en el pie) y «Qué pasó» (`detail.what_happened`); una línea fina y el pie con los códigos
 * como etiquetas y «Ver detalles →». Toda la tarjeta es el enlace: «Ver detalles» se estira sobre ella (un solo destino, sin enlaces anidados). Con `link` es un enlace de ruta (la campana);
 * sin él, un botón que avisa por `opened` (el centro abre el detalle).
 *
 *   <app-notification-card [notification]="n" [typeLabel]="label" [ago]="ago" [link]="link" (opened)="select(n)" />
 */
@Component({
  selector: 'app-notification-card',
  imports: [RouterLink, TranslatePipe, Tag, UnreadDot],
  templateUrl: './notification-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
})
export class NotificationCard {
  /** El título describe a «Ver detalles»: cada enlace se distingue de los demás por su aviso. */
  protected readonly titleId = `notice-title-${nextCardId++}`;
  readonly notification = input.required<NotificationItem>();
  /** La etiqueta del tipo (del catálogo); sin ella se usa el valor. Nombra el ícono para lectores de pantalla. */
  readonly typeLabel = input<string | null>(null);
  /** «hace 14 horas», ya formateado. */
  readonly ago = input('');
  /** Si viene, «Ver detalles» es un enlace a esa ruta; si no, un botón que emite `opened`. */
  readonly link = input<NotificationLink | null>(null);

  readonly opened = output<void>();

  protected readonly appearance = computed(() => noticeAppearance(this.notification().type));
  protected readonly toneClass = computed(() => TONE_CLASS[this.appearance().tone]);
  protected readonly title = computed(() => {
    const parts = titleParts(this.notification());
    return parts.text || this.notification().title;
  });
  protected readonly codes = computed(() => cardCodes(this.notification()));
}
