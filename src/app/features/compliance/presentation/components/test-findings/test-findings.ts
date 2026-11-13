import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { riskLevelLook } from '@shared/presentation/components/risk-level-badge/risk-level-badge';
import { ControlDimension } from '@features/compliance/domain/models/control.models';
import { Finding, FindingSeverity } from '@features/compliance/domain/models/finding.models';
import { FindingService } from '@features/compliance/domain/services/finding.service';
import { remediationBlocks } from '@features/compliance/domain/utils/remediation-text';

type Stage = 'closed' | 'loading' | 'ready' | 'error';

// La severidad de un hallazgo usa la escala de nivel de riesgo del sistema (`risk-*`: crítica, alta, media = moderada, baja) y el neutro para lo informativo; no son los tonos de
// estado. La severidad siempre va con su palabra y sin icono.
const SEVERITY_CHIP: Record<FindingSeverity, string> = {
  critical: riskLevelLook('critical'),
  high: riskLevelLook('high'),
  medium: riskLevelLook('moderate'),
  low: riskLevelLook('low'),
  informational: 'border-line bg-canvas text-ink-muted',
};
const SHOWN_RESOURCES = 5;

// D90 · Bajo una prueba técnica que no cumple: qué falló en la última evaluación y cómo corregirlo. Se pide al abrirlo (no al pintar el control). La guía puede venir
// traducida por una IA: entonces lo dice, porque nadie la ha revisado; si no hay traducción, se muestra el original en inglés y también se dice.
@Component({
  selector: 'app-test-findings',
  imports: [TranslatePipe, LoadingSpinner],
  templateUrl: './test-findings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestFindings {
  private readonly api = inject(FindingService);

  readonly controlId = input.required<string>();
  readonly testId = input.required<string>();
  // De qué mide la prueba: en la nube se afectan «recursos»; en un servidor, base de datos o aplicación, «activos» (lo que el cliente declaró).
  readonly dimension = input<ControlDimension>('cloud');

  readonly stage = signal<Stage>('closed');
  readonly items = signal<Finding[]>([]);
  readonly total = signal(0);
  readonly measuredAt = signal<string | null>(null);
  readonly loadingMore = signal(false);
  private page = 1;
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  readonly hasMore = computed(() => this.items().length < this.total());
  // «De la más grave a la menos grave» solo si lo que se mostró trae nivel: la sonda de servidores no califica sus checks y no se inventa uno.
  readonly ranked = computed(() => this.items().some((f) => f.severity !== null));
  protected readonly SHOWN = SHOWN_RESOURCES;
  protected readonly chip = SEVERITY_CHIP;
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