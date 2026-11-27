import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Busy } from '@shared/presentation/directives/busy';
import { LanguageService } from '@core/domain/services/language.service';
import { ControlDetail, ManagementHistoryItem, ManagementPerson } from '@features/compliance/domain/models/control.models';
import { ControlManagementService } from '@features/compliance/domain/services/control-management.service';
import { ManagementLabelsService } from '@shared/domain/services/management-labels.service';
import { personLabel } from '@features/compliance/domain/utils/control-approval';
import { formatLocalDate } from '@shared/domain/utils/date-format';
import { DetailSection } from '@shared/presentation/components/detail-section/detail-section';
import { timeout } from 'rxjs';
import { LOAD_TIMEOUT_MS } from '@shared/domain/utils/load-timeout';
import { SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { ExpandableText } from '@shared/presentation/components/expandable-text/expandable-text';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { Tag } from '@shared/presentation/components/tag/tag';
import { statusTone } from '@features/compliance/domain/utils/control-v2-look';
import { RouterLink } from '@angular/router';
import { SessionService } from '@core/domain/services/session.service';
import { initialsOf } from '@shared/presentation/components/person-cell/person-cell';
import { canSeeTeam } from '@shared/domain/utils/roles';
import { RouteLink, personLink } from '@shared/domain/models/route-links';

type Stage = 'loading' | 'ready' | 'error';
const PAGE_SIZE = 10;
// El tope de `page_size` del contrato (conventions.md).
const MAX_PAGE_SIZE = 100;
// El texto que acompaña cada acto, por orden de preferencia (`detail` de cada `type`, contracts/cumplimiento/gestion.md).
const WHY_KEYS = ['reason', 'justification', 'note', 'what', 'description'] as const;
// Una decisión aprobada o rechazada lleva su resultado al lado de la etiqueta («"No aplica" decidido» sola no dice qué se decidió).
const DECISION_TONES: Record<string, StatusTone> = { approved: 'ok', rejected: 'bad' };

// «Historial» (DT-116): lo que pasó en el control, el más reciente primero, con «Ver más». Se vuelve a pedir cuando el control cambia (cada acción recarga el detalle).
// Una tabla de solo lectura (filas sin clic ni hover): Fecha (con hora, en una línea) · Persona (su círculo de iniciales y su nombre; un enlace a su detalle en Equipo para quien
// puede ver Equipo) · Acción (la frase, su resultado y el código de la prueba o el requisito, en línea) · Detalle (en el color del texto; 2 líneas y «Ver más» solo si no cabe).
@Component({
  selector: 'app-control-history',
  imports: [TranslatePipe, RouterLink, DetailSection, SkeletonRegion, DataTable, TableCell, ExpandableText, StatusIndicator, Tag, Busy],
  templateUrl: './control-history.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlHistory {
  private readonly api = inject(ControlManagementService);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly labels = inject(ManagementLabelsService);
  protected readonly personLabel = personLabel;
  private readonly session = inject(SessionService);
  /** Solo quien puede ver Equipo abre el detalle de una persona; para el resto, su nombre y su círculo sin enlace. */
  protected readonly canOpenPeople = computed(() => canSeeTeam(this.session.user()?.role));

  readonly detail = input.required<ControlDetail>();

  // Fecha con ancho fijo y sin salto; la persona con su círculo; la acción, un tercio; el detalle, el resto. El esqueleto tiene las mismas columnas y formas.
  protected readonly columns: TableColumn<ManagementHistoryItem>[] = [
    { key: 'at', headerKey: 'COMPLIANCE.APPROVAL.HISTORY.COL_DATE', class: 'lg:w-44 whitespace-nowrap' },
    { key: 'actor', headerKey: 'COMPLIANCE.APPROVAL.HISTORY.COL_PERSON', class: 'lg:w-64', skeleton: 'person' },
    { key: 'action', headerKey: 'COMPLIANCE.APPROVAL.HISTORY.COL_ACTION', class: 'lg:w-1/3', skeleton: 'lines' },
    { key: 'detail', headerKey: 'COMPLIANCE.APPROVAL.HISTORY.COL_DETAIL', skeleton: 'lines' },
  ];
  protected readonly rowKey = (i: ManagementHistoryItem) => i.id + i.type;
  protected readonly none: ManagementHistoryItem[] = [];

  protected readonly stage = signal<Stage>('loading');
  protected readonly items = signal<ManagementHistoryItem[]>([]);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = computed(() => this.page() < this.totalPages());
  protected readonly moreFailed = signal(false);
  /** La recarga falló con filas ya mostradas: se conserva la tabla y el aviso ofrece reintentar. */
  protected readonly reloadFailed = signal(false);
  /** «{n} más cargados», para lectores de pantalla (`aria-live`, siempre montado). */
  protected readonly announcement = signal('');
  private readonly destroyRef = inject(DestroyRef);
  private seq = 0;
  /** El control de lo que hay en pantalla: otro control no conserva filas del anterior. */
  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const d = this.detail();
      untracked(() => this.reload(d.id));
    });
  }

  reload(controlId: string = this.detail().id): void {
    const seq = ++this.seq;
    this.moreFailed.set(false);
    this.reloadFailed.set(false);
    this.loadingMore.set(false);
    if (controlId !== this.loadedFor) {
      this.items.set([]);
      this.page.set(0);
      this.totalPages.set(0);
      this.stage.set('loading');
    } else if (this.items().length === 0) {
      // El mismo control con filas se deja mientras llegan las nuevas: el historial no parpadea tras cada acción.
      this.stage.set('loading');
    }
    // Tras una acción se vuelve a pedir TODO lo que ya estaba cargado (una sola llamada con el tamaño de las páginas vistas), para no perder lo que se abrió con «Ver más».
    const loadedPages = controlId === this.loadedFor ? Math.max(1, this.page()) : 1;
    this.api.history(controlId, 1, Math.min(loadedPages * PAGE_SIZE, MAX_PAGE_SIZE)).pipe(timeout(LOAD_TIMEOUT_MS), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (seq !== this.seq) return;
        this.loadedFor = controlId;
        this.items.set(r.items);
        // `more()` pide de a PAGE_SIZE: la página actual y el total se cuentan con ese tamaño, no con el de esta respuesta.
        this.page.set(loadedPages === 1 ? r.page.page : Math.max(1, Math.ceil(r.items.length / PAGE_SIZE)));
        this.totalPages.set(loadedPages === 1 ? r.page.totalPages : Math.ceil(r.page.total / PAGE_SIZE));
        this.stage.set('ready');
      },
      error: () => {
        if (seq !== this.seq) return;
        if (this.loadedFor === controlId && this.items().length > 0) this.reloadFailed.set(true);
        else this.stage.set('error');
      },
    });
  }

  more(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    const seq = this.seq;
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.api.history(this.detail().id, this.page() + 1, PAGE_SIZE).pipe(timeout(LOAD_TIMEOUT_MS), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.loadingMore.set(false);
        if (seq !== this.seq) return;
        const before = this.items().length;
        this.items.update((list) => [...list, ...r.items]);
        this.page.set(r.page.page);
        this.totalPages.set(r.page.totalPages);
        this.announcement.set(this.translate.instant('COMPLIANCE.APPROVAL.HISTORY.MORE_LOADED', { n: r.items.length }));
        this.focusRow(before);
      },
      error: () => {
        this.loadingMore.set(false);
        if (seq === this.seq) this.moreFailed.set(true);
      },
    });
  }

  /** El foco pasa a la primera fila nueva (el botón «Ver más» no lo pierde sin destino). */
  private focusRow(index: number): void {
    afterNextRender(() => {
      const row = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-history-row]')[index];
      if (!row) return;
      row.setAttribute('tabindex', '-1');
      row.focus();
    }, { injector: this.injector });
  }

  /** Fecha y hora del acto («26 nov 2026, 10:00»). */
  protected when(iso: string): string {
    return formatLocalDate(iso, this.language.current(), { time: true }) || iso;
  }

  /** Las iniciales del círculo, las mismas que la persona tiene en Equipo (la tabla y su detalle, `app-person-cell`). */
  protected initials(person: ManagementPerson): string {
    return initialsOf(personLabel(person));
  }

  /** El detalle de la persona en Equipo (`/equipo/personas?abrir=<id>`). */
  protected personLink(person: ManagementPerson): RouteLink {
    return personLink(person.id);
  }

  /** La prueba o el requisito del acto, con su código (y el nombre de la prueba). */
  protected target(item: ManagementHistoryItem): { code: string; name: string | null } | null {
    if (item.test) return { code: item.test.code, name: item.test.display_name || null };
    if (item.requirement) return { code: item.requirement.code, name: null };
    return null;
  }

  /** El resultado de una prueba o lo que se decidió en una solicitud, como estado junto a la etiqueta. */
  protected outcome(item: ManagementHistoryItem): { tone: StatusTone; label: string } | null {
    const d = item.detail;
    if (item.type === 'manual_result' && typeof d['result'] === 'string') {
      return { tone: statusTone(d['result']), label: this.labels.label('manual_test_result_value', d['result']) };
    }
    if (item.type.endsWith('_decided') && typeof d['decision'] === 'string') {
      return { tone: DECISION_TONES[d['decision']] ?? 'neutral', label: this.labels.label('change_request_status', d['decision']) };
    }
    return null;
  }

  /** El motivo, la justificación, la nota o el texto que acompaña el acto, si lo hay. */
  protected why(item: ManagementHistoryItem): string | null {
    for (const key of WHY_KEYS) {
      const value = item.detail[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return null;
  }
}
