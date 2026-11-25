import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Busy } from '@shared/presentation/directives/busy';
import { Card } from '@shared/presentation/components/card/card';
import { DetailModal } from '@shared/presentation/components/detail-modal/detail-modal';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';
import { LocalDatePipe } from '@shared/presentation/pipes/local-date.pipe';
import { NOTIFICATION_DETAIL_FIELDS, NotificationDetailField, NotificationItem } from '@features/notifications/domain/models/notification.models';
import { groupedControlLinks, notificationLink } from '@features/notifications/domain/utils/notification-link';

interface DetailBlock {
  field: NotificationDetailField;
  text: string;
}

// Lo que se lee primero es «Qué pasó» y lo que se hace, «Cómo corregirlo»; los otros cinco campos son los datos para actuar, en una cuadrícula compacta.
const FACT_FIELDS: readonly NotificationDetailField[] = ['why_it_matters', 'who', 'time_needed', 'evidence', 'impact'];

// El detalle de un aviso en el panel lateral (`drawer-narrow`, decisión de Rod): arriba una franja de metadatos (servicio, tipo, recibido, cierre si lo hay, estado);
// «Qué pasó» destacado con el control enlazado; «Cómo corregirlo» como bloque de acción con el botón que lleva al destino; y los otros cinco campos en dos columnas,
// sin los que vengan vacíos. Los textos vienen traducidos del backend y no se reescriben. La campana y el Centro de avisos lo usan.
@Component({
  selector: 'app-notification-detail',
  imports: [RouterLink, TranslatePipe, Busy, Card, DetailModal, StatusIndicator, Tag, LocalDatePipe],
  templateUrl: './notification-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationDetailPanel {
  readonly notification = input.required<NotificationItem>();
  /** La etiqueta del tipo (del catálogo del backend); sin ella se muestra el valor. */
  readonly typeLabel = input<string | null>(null);
  readonly working = input(false);

  readonly closed = output<void>();
  /** Marcar como leído (`true`) o como no leído (`false`). */
  readonly readChange = output<boolean>();
  /** Se siguió el enlace al destino: quien lo usa lo marca leído. */
  readonly followed = output<void>();

  protected readonly link = computed(() => notificationLink(this.notification()));
  /** Los controles de la notificación agrupada, cada uno con su enlace. */
  protected readonly groupedControls = computed(() => groupedControlLinks(this.notification()));
  /** El texto del botón de «Cómo corregirlo»: abrir el control, o asignar los controles sin dueño (notificación agrupada de un servicio). */
  protected readonly actionKey = computed(() => (this.notification().target.kind === 'service' ? 'NOTIFICATIONS.DETAIL.ASSIGN_UNOWNED' : 'NOTIFICATIONS.DETAIL.OPEN_CONTROL'));
  protected readonly blocks = computed<DetailBlock[]>(() => {
    const detail = this.notification().detail;
    return NOTIFICATION_DETAIL_FIELDS.flatMap((field) => {
      const text = detail[field]?.trim();
      return text ? [{ field, text }] : [];
    });
  });
  protected readonly what = computed(() => this.blocks().find((b) => b.field === 'what_happened') ?? null);
  protected readonly fix = computed(() => this.blocks().find((b) => b.field === 'how_to_fix') ?? null);
  protected readonly facts = computed(() => this.blocks().filter((b) => FACT_FIELDS.includes(b.field)));
}
