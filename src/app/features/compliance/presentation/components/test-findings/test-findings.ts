import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { StatusIndicator } from '@shared/presentation/components/status-indicator/status-indicator';
import type { StatusTone } from '@shared/domain/models/status-tone.model';
import { Finding, FindingSeverity } from '@features/compliance/domain/models/finding.models';
import { FindingService } from '@features/compliance/domain/services/finding.service';
import { remediationBlocks } from '@features/compliance/domain/utils/remediation-text';
import { Skeleton, SkeletonRegion } from '@shared/presentation/components/skeleton/skeleton';
import { Busy } from '@shared/presentation/directives/busy';

type Stage = 'closed' | 'loading' | 'ready' | 'error';

// La severidad de un hallazgo usa la escala de nivel de riesgo del sistema (`risk-*`: crítica, alta, media = moderada, baja) y el neutro para lo informativo; no son los tonos de
// estado. La severidad siempre va con su palabra y sin icono.
const SEVERITY_TONE: Record<FindingSeverity, StatusTone> = {
  critical: 'risk-critical',
  high: 'risk-high',
  medium: 'risk-moderate',
  low: 'risk-low',
  informational: 'neutral',
};
const SHOWN_RESOURCES = 5;

// D90 · Bajo una prueba técnica que no cumple: qué falló en la última evaluación y cómo corregirlo. Se pide al abrirlo (no al pintar el control). La guía puede venir
// traducida por una IA: entonces lo dice, porque nadie la ha revisado; si no hay traducción, se muestra el original en inglés y también se dice.
@Component({
  selector: 'app-test-findings',
  imports: [TranslatePipe, StatusIndicator, Skeleton, SkeletonRegion, Busy],
  templateUrl: './test-findings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestFindings {
  private readonly api = inject(FindingService);

  readonly controlId = input.required<string>();
  readonly testId = input.required<string>();

  readonly stage = signal<Stage>('closed');
  readonly items = signal<Finding[]>([]);
  readonly total = signal(0);
  readonly measuredAt = signal<string | null>(null);
  readonly loadingMore = signal(false);
  private page = 1;
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  readonly hasMore = computed(() => this.items().length < this.total());
  protected readonly SHOWN = SHOWN_RESOURCES;
  protected readonly tone = SEVERITY_TONE;
  protected readonly blocks = remediationBlocks;

  toggle(): void {
    if (this.stage() === 'closed') this.load();
    else this.stage.set('closed');
  }

  load(): void {
    this.stage.set('loading');
    this.page = 1;
    this.api.list(this.controlId(), this.testId(), 1).subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.total.set(r.total);
        this.measuredAt.set(r.measured_at);
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  more(): void {
    if (this.loadingMore()) return;
    this.loadingMore.set(true);
    this.api.list(this.controlId(), this.testId(), this.page + 1).subscribe({
      next: (r) => {
        this.page += 1;
        this.items.update((list) => [...list, ...r.items]);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  expand(id: string): void {
    this.expanded.update((s) => new Set(s).add(id));
  }

  shown(f: Finding) {
    return this.isExpanded(f.id) ? f.resources : f.resources.slice(0, SHOWN_RESOURCES);
  }
}