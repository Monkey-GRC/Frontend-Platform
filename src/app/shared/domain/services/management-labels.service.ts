import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of, retry, switchMap, tap, timer } from 'rxjs';
import { LanguageService } from '@core/domain/services/language.service';
import { CatalogName, CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';

/** Los catálogos de la gestión del control: el backend sirve sus etiquetas en el idioma de la sesión. */
export type ManagementCatalog =
  | 'control_management_state' | 'manual_test_result_value' | 'control_level' | 'requirement_status' | 'management_history_type' | 'requirement_applicability' | 'change_request_status' | 'work_decision_kind';

/** Cuánto espera antes de reintentar un catálogo que falló (ms); los specs lo ponen en 0. */
export const LABELS_RETRY_DELAY_MS = new InjectionToken<number>('LABELS_RETRY_DELAY_MS', { providedIn: 'root', factory: () => 1000 });

export type CatalogStatus = 'loading' | 'ready' | 'failed';

const CATALOGS: readonly ManagementCatalog[] = [
  'control_management_state', 'manual_test_result_value', 'control_level', 'requirement_status', 'management_history_type', 'requirement_applicability', 'change_request_status', 'work_decision_kind',
];

// Las etiquetas de la gestión del control, del nivel, de los requisitos, del historial y de lo que espera una decisión: las sirve el backend en el idioma de la sesión.
// Al cambiar el idioma se cancelan las peticiones del anterior y se piden de nuevo (`switchMap`), así una respuesta lenta nunca pisa a la nueva. Mientras no llegan (o si el valor es nuevo),
// se muestra el valor tal cual. Vive en `shared/` porque lo usan Cumplimiento y «Mi trabajo». Nunca hay listas escritas aquí.
@Injectable({ providedIn: 'root' })
export class ManagementLabelsService {
  private readonly catalogs = inject(CatalogService);
  private readonly language = inject(LanguageService);

  private readonly retryDelay = inject(LABELS_RETRY_DELAY_MS);
  private readonly statuses = signal<Partial<Record<ManagementCatalog, CatalogStatus>>>({});
  private readonly lists = signal<Partial<Record<ManagementCatalog, CatalogOption[]>>>({});
  readonly results = () => this.lists().manual_test_result_value ?? [];

  constructor() {
    toObservable(this.language.current)
      .pipe(
        switchMap(() => {
          // Lo que ya estaba cargado se conserva; el resto vuelve a «cargando».
          this.statuses.update((cur) => Object.fromEntries(CATALOGS.map((n) => [n, cur[n] === 'ready' ? 'ready' : 'loading'])));
          return forkJoin(CATALOGS.map((name) => this.catalogs.options(name as CatalogName).pipe(
            retry({ count: 1, delay: () => timer(this.retryDelay) }),
            tap((list) => this.setStatus(name, list ? 'ready' : 'failed')),
            catchError(() => {
              if (this.statuses()[name] !== 'ready') this.setStatus(name, 'failed');
              return of(null);
            }),
          )));
        }),
        takeUntilDestroyed(),
      )
      // Un catálogo que falló (tras reintentar una vez) no pisa el que ya estaba cargado: se queda el anterior (o, si no hubo, el valor tal cual).
      .subscribe({
        next: (all) =>
          this.lists.update((current) => {
            const next = { ...current };
            CATALOGS.forEach((name, i) => {
              const loaded = all[i];
              if (loaded) next[name] = loaded;
            });
            return next;
          }),
      });
  }

  private setStatus(name: ManagementCatalog, status: CatalogStatus): void {
    this.statuses.update((cur) => ({ ...cur, [name]: status }));
  }

  /** En qué punto va un catálogo: cargando, listo o fallido (aun tras reintentar). */
  status(name: ManagementCatalog): CatalogStatus {
    return this.statuses()[name] ?? 'loading';
  }

  options(name: ManagementCatalog): CatalogOption[] {
    return this.lists()[name] ?? [];
  }

  label(name: ManagementCatalog, value: string | null | undefined): string {
    if (!value) return '—';
    return this.options(name).find((o) => o.value === value)?.label ?? value;
  }

  state(value: string): string {
    return this.label('control_management_state', value);
  }
}
