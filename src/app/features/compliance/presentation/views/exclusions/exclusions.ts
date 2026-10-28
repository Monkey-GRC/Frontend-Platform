import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Exclusion, ExclusionStatus } from '../../../domain/models/exclusion.models';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';
import { EnumLabelService } from '../../../domain/services/enum-label.service';
import { ExclusionService } from '../../../domain/services/exclusion.service';

type Stage = 'loading' | 'error' | 'forbidden' | 'ready';

// Las exclusiones del servicio (MD-144, D96): sacar un activo del universo de una prueba. La crea y la decide el administrador de la empresa en un solo acto: nace aprobada y el
// activo deja de medirse en esa prueba hasta que venza (el fin del período). El administrador y el auditor las leen. Crear una desde un control está por construir.
@Component({
  selector: 'app-exclusions',
  imports: [TranslatePipe, LoadingSpinner],
  templateUrl: './exclusions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExclusionsView implements OnInit {
  private readonly api = inject(ExclusionService);
  private readonly language = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  readonly view = inject(ComplianceViewService);
  readonly labels = inject(EnumLabelService);

  // La vista es hija de `services/:id/cumplimiento`: el id del servicio está en la ruta del padre.
  private readonly params = toSignal(this.route.parent!.paramMap, { requireSync: true });
  readonly serviceId = computed(() => this.params().get('id') ?? '');

  // Los estados de una exclusión salen del backend (enum de Postgres `exclusion_status`).
  readonly statuses = toSignal(inject(CatalogService).options('exclusion_status'), { initialValue: [] });
  readonly stage = signal<Stage>('loading');
  readonly all = signal<Exclusion[]>([]);
  readonly filter = signal<ExclusionStatus | null>(null);
  readonly items = computed(() => {
    const f = this.filter();
    return f ? this.all().filter((e) => e.status === f) : this.all();
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    this.api.listAll(this.serviceId()).subscribe({
      next: (items) => {
        this.all.set(items);
        this.stage.set('ready');
      },
      error: (e: unknown) => this.stage.set(e instanceof HttpErrorResponse && e.status === 403 ? 'forbidden' : 'error'),
    });
  }

  count(status: ExclusionStatus): number {
    return this.all().filter((e) => e.status === status).length;
  }

  fullName(p: { name: string | null; last_name: string | null } | null): string {
    return p ? [p.name, p.last_name].filter(Boolean).join(' ') : '';
  }

  /** `AAAA-MM-DD` es un día, sin hora ni zona: se muestra ese día en UTC para que no corra por la zona horaria. */
  day(value: string): string {
    return new Intl.DateTimeFormat(this.language.current(), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  }
}
