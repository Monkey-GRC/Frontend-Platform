import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { ConfirmDialog } from '@shared/presentation/components/confirm-dialog/confirm-dialog';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Exclusion, ExclusionStatus } from '../../../domain/models/exclusion.models';
import { ComplianceViewService } from '../../../domain/services/compliance-view.service';
import { EnumLabelService } from '../../../domain/services/enum-label.service';
import { ExclusionService } from '../../../domain/services/exclusion.service';

type Stage = 'loading' | 'error' | 'forbidden' | 'ready';

// Las exclusiones del servicio (MD-144): sacar un activo del universo de una prueba. La propone la empresa y la decide el consultor; mientras está pendiente
// no cambia nada y el activo sigue contando. El consultor aprueba o rechaza (rechazar exige el motivo); el administrador y el auditor la leen.
// Proponer una exclusión desde un control espera a que el detalle del control traiga el id de cada prueba (PEDIDO-A-HECTOR.md, punto 4).
@Component({
  selector: 'app-exclusions',
  imports: [TranslatePipe, ConfirmDialog, LoadingSpinner],
  templateUrl: './exclusions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExclusionsView implements OnInit {
  private readonly api = inject(ExclusionService);
  private readonly translate = inject(TranslateService);
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

  readonly saving = signal(false);
  readonly notice = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  // La decisión: aprobar pide confirmar; rechazar pide el motivo.
  readonly approving = signal<Exclusion | null>(null);
  readonly rejecting = signal<string | null>(null);
  readonly note = signal('');

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

  askApprove(e: Exclusion): void {
    this.reset();
    this.approving.set(e);
  }

  confirmApprove(): void {
    const e = this.approving();
    if (!e) return;
    this.decide(e.id, { status: 'approved' }, 'COMPLIANCE.EXCLUSIONS.APPROVED', () => this.approving.set(null));
  }

  startReject(e: Exclusion): void {
    this.reset();
    this.note.set('');
    this.rejecting.set(e.id);
  }

  cancelReject(): void {
    this.rejecting.set(null);
  }

  confirmReject(): void {
    const id = this.rejecting();
    const note = this.note().trim();
    if (!id || !note) return;
    this.decide(id, { status: 'rejected', decision_note: note }, 'COMPLIANCE.EXCLUSIONS.REJECTED', () => this.rejecting.set(null));
  }

  fullName(p: { name: string | null; last_name: string | null } | null): string {
    return p ? [p.name, p.last_name].filter(Boolean).join(' ') : '';
  }

  /** `AAAA-MM-DD` es un día, sin hora ni zona: se muestra ese día en UTC para que no corra por la zona horaria. */
  day(value: string): string {
    return new Intl.DateTimeFormat(this.language.current(), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  }

  private decide(id: string, body: { status: 'approved' | 'rejected'; decision_note?: string }, noticeKey: string, done: () => void): void {
    this.saving.set(true);
    this.reset();
    this.api.decide(id, body).subscribe({
      next: () => {
        this.saving.set(false);
        done();
        this.notice.set(this.translate.instant(noticeKey));
        this.load();
      },
      // `message` ya viene traducido por el backend (403: no es consultor; 409: ya se decidió; 422: falta el motivo).
      error: (e) => {
        this.saving.set(false);
        this.approving.set(null);
        this.error.set(apiErrorMessage(e, this.translate.instant('COMPLIANCE.EXCLUSIONS.SAVE_ERROR')));
      },
    });
  }

  private reset(): void {
    this.notice.set(null);
    this.error.set(null);
  }
}
