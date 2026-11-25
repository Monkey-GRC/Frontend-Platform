import { Directive, Signal, computed, effect, inject, input, linkedSignal, output, signal, untracked } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { TableColumn } from '@shared/presentation/components/data-table/data-table';
import { TabItem } from '@shared/presentation/components/tabs/tabs';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';
import { ComplianceViewService } from '@shared/domain/services/compliance-view.service';
import { EnumLabelService } from '@shared/domain/services/enum-label.service';
import { PickerItem } from '../link-picker/link-picker';

export type Stage = 'loading' | 'error' | 'ready';

/** La última columna de las listas compactas de un detalle: las acciones de cada fila, con el encabezado solo para lectores de pantalla. */
export const actionsColumn = <T>(): TableColumn<T> => ({ key: 'actions', headerKey: 'COMMON.TABLE.ACTIONS', align: 'right', srOnlyHeader: true });

/**
 * El esqueleto de los detalles de compliance (control, riesgo y causa): la carga con su etapa, la pestaña abierta (`?tab=`), el aviso de error y el flujo de dar de baja.
 * Cada detalle dice qué pide (`request`), qué pestañas tiene y a qué llama para darse de baja.
 */
@Directive()
export abstract class DetailPanelBase<T, Tab extends string> {
  protected readonly translate = inject(TranslateService);
  protected readonly toast = inject(ToastService);
  readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  /** La pestaña pedida por la dirección (`?tab=`); si no existe, la primera. */
  readonly requestedTab = input<string | null>(null);
  readonly tabChange = output<string>();
  /** Se cerró el panel (o se dio de baja el elemento). */
  readonly closed = output<void>();
  /** El elemento cambió (se editó, se vinculó algo o se dio de baja): la lista se vuelve a pedir. */
  readonly changed = output<void>();

  readonly stage = signal<Stage>('loading');
  readonly detail = signal<T | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly confirmingRemove = signal(false);

  /** El detalle ya cargado (para la cabecera): `null` mientras carga o si falló. */
  protected readonly ready = computed(() => (this.stage() === 'ready' ? this.detail() : null));

  /** Las pestañas posibles; la primera es la de entrada. */
  protected abstract readonly tabIds: readonly [Tab, ...Tab[]];
  /** Las pestañas que aplican ahora (con la cuenta de lo que traen). */
  abstract readonly tabs: Signal<TabItem[]>;
  protected abstract readonly saveErrorKey: string;
  /** La llamada que trae el detalle; lee aquí el id y la vista, para que el panel lo vuelva a pedir si cambian. */
  protected abstract request(): Observable<T>;
  /** La llamada que da de baja el elemento. */
  protected abstract remove(): Observable<unknown>;

  private readonly tab = linkedSignal<string | null, Tab>({ source: this.requestedTab, computation: (t) => this.tabIds.find((x) => x === t) ?? this.tabIds[0] });
  /** La pestaña elegida si sigue existiendo (p. ej. tras volver a pedir el detalle); si no, la primera. */
  readonly activeTab = computed<Tab>(() => (this.tabs().some((t) => t.id === this.tab()) ? this.tab() : this.tabIds[0]));

  private loadSeq = 0;

  constructor() {
    effect(() => {
      const call = this.request();
      untracked(() => {
        this.onRequest();
        this.fetch(call);
      });
    });
  }

  selectTab(id: string): void {
    const tab = this.tabIds.find((t) => t === id);
    if (!tab) return;
    this.tab.set(tab);
    this.tabChange.emit(tab);
  }

  /** Se pidió otro elemento (o la misma vista cambió): lo que quedó a medias del anterior (buscadores, páginas, borradores, avisos) se descarta. Un `load()` para refrescar no pasa por aquí. */
  protected onRequest(): void {
    this.confirmingRemove.set(false);
    this.resetFeedback();
  }

  load(): void {
    this.fetch(this.request());
  }

  private fetch(call: Observable<T>): void {
    const seq = ++this.loadSeq;
    this.stage.set('loading');
    call.subscribe({
      next: (detail) => {
        if (seq !== this.loadSeq) return;
        this.detail.set(detail);
        this.stage.set('ready');
      },
      error: () => seq === this.loadSeq && this.stage.set('error'),
    });
  }

  askRemove(): void {
    this.resetFeedback();
    this.confirmingRemove.set(true);
  }

  confirmRemove(): void {
    this.saving.set(true);
    this.resetFeedback();
    this.remove().subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmingRemove.set(false);
        // El elemento ya no existe para las listas: se avisa y se cierra el panel.
        this.changed.emit();
        this.closed.emit();
      },
      error: (e) => this.fail(e),
    });
  }

  protected fail(error: unknown): void {
    this.saving.set(false);
    this.confirmingRemove.set(false);
    // `message` ya viene traducido por el backend (409: vínculo repetido, ya dado de baja…).
    this.error.set(apiErrorMessage(error, this.translate.instant(this.saveErrorKey)));
  }

  protected resetFeedback(): void {
    this.error.set(null);
  }
}

/** Los detalles que vinculan y desvinculan otros elementos (el riesgo con sus causas, la causa con sus controles) y que solo dan de baja lo propio de la empresa. */
@Directive()
export abstract class LinkedDetailPanelBase<T extends { origin: string }, Tab extends string, L> extends DetailPanelBase<T, Tab> {
  readonly picking = signal(false);
  readonly candidates = signal<PickerItem[]>([]);
  readonly unlinking = signal<L | null>(null);

  /** Dar de baja es solo de un elemento propio; los del catálogo no se quitan desde la pantalla. */
  readonly canRemove = computed(() => this.view.canManage() && this.detail()?.origin === 'own');

  protected abstract readonly noticeKeys: { linked: string; unlinked: string };
  protected override onRequest(): void {
    super.onRequest();
    this.picking.set(false);
    this.candidates.set([]);
    this.unlinking.set(null);
  }

  /** Lo que se puede vincular ahora: lo del servicio que aún no está vinculado. */
  protected abstract candidatesFor(detail: T): Observable<PickerItem[]>;
  protected abstract linkCall(id: string): Observable<unknown>;
  protected abstract unlinkCall(item: L): Observable<unknown>;

  startLink(): void {
    const d = this.detail();
    if (!d) return;
    this.resetFeedback();
    this.picking.set(true);
    this.candidatesFor(d).subscribe({ next: (items) => this.candidates.set(items), error: () => this.fail(null) });
  }

  link(id: string): void {
    this.run(this.linkCall(id), this.noticeKeys.linked, () => this.picking.set(false));
  }

  askUnlink(item: L): void {
    this.resetFeedback();
    this.unlinking.set(item);
  }

  confirmUnlink(): void {
    const item = this.unlinking();
    if (!item) return;
    this.run(this.unlinkCall(item), this.noticeKeys.unlinked, () => this.unlinking.set(null));
  }

  private run(call: Observable<unknown>, noticeKey: string, done: () => void): void {
    this.saving.set(true);
    this.resetFeedback();
    call.subscribe({
      next: () => {
        this.saving.set(false);
        done();
        this.toast.showSuccess(this.translate.instant(noticeKey));
        this.load();
        this.changed.emit();
      },
      error: (e) => {
        this.unlinking.set(null);
        this.fail(e);
      },
    });
  }
}
