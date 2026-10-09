import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Asset, DiscoveredAsset, DiscoveredAssetsPage } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';

const KIND_ICON: Record<string, string> = { server: 'dns', database: 'database', storage: 'folder_open', function: 'function', other: 'category' };
const SERVICE_NAME: Record<string, string> = { ec2: 'servidores', rds: 'bases de datos', lambda: 'funciones', s3: 'almacenamiento', timeout: 'algunos servicios (tardaron demasiado)' };

// Lo que la conexión reconoció en la cuenta del cliente: sus activos, por clase y con lo que se pudo leer de cada uno (D59).
// Es la prueba de que Monkey «ve» lo que el cliente va a evaluar, no solo de que la conexión funciona.
@Component({
  selector: 'app-discovered-assets',
  imports: [DatePipe],
  templateUrl: './discovered-assets.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoveredAssets implements OnInit {
  private readonly api = inject(TechnicalControlService);
  private readonly catalogs = inject(CatalogService);

  readonly asset = input.required<Asset>();
  // Volver a mirar la cuenta (vuelve a comprobar la conexión). Quien lo hace es la tarjeta del sistema.
  readonly refreshing = input(false);
  // En modo demostración la conexión se «comprueba» sin tocar la cuenta: no hay descubrimiento, y se dice (no se deja creer que falta algo).
  readonly probeMode = input<string>('unavailable');
  readonly refreshRequested = output<void>();

  readonly page = signal<DiscoveredAssetsPage | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly kind = signal<string | null>(null);
  private readonly kinds = signal<CatalogOption[]>([]);

  readonly total = computed(() => (this.page()?.summary ?? []).reduce((n, s) => n + s.count, 0));
  readonly chips = computed(() => (this.page()?.summary ?? []).map((s) => ({ ...s, label: this.kindLabel(s.kind), icon: KIND_ICON[s.kind] ?? 'category' })));
  readonly incomplete = computed(() => (this.page()?.incomplete_services ?? []).map((s) => SERVICE_NAME[s] ?? s).join(', '));

  constructor() {
    // Cuando el sistema vuelve a comprobarse (cambia su última validación), la lista se vuelve a leer.
    effect(() => {
      this.asset().provisioning.last_validated_at;
      untracked(() => this.load());
    });
  }

  ngOnInit(): void {
    this.catalogs.options('resource_kind').subscribe((o) => this.kinds.set(o));
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.listDiscovered(this.asset().id, this.kind() ?? undefined).subscribe({
      next: (page) => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  pick(kind: string): void {
    this.kind.set(this.kind() === kind ? null : kind);
    this.load();
  }

  kindLabel(kind: string): string {
    return this.kinds().find((k) => k.value === kind)?.label ?? kind;
  }

  icon(kind: string): string {
    return KIND_ICON[kind] ?? 'category';
  }

  // Lo que se sabe de cada activo, dicho sin jerga. Lo que no se pudo leer no se muestra (no se inventa).
  detail(a: DiscoveredAsset): string {
    const at = a.attributes;
    const str = (k: string) => (typeof at[k] === 'string' && at[k] ? (at[k] as string) : null);
    if (a.kind === 'server') return str('os') ? `${str('os')} (según su imagen)` : (str('platform') ?? 'Sistema operativo no identificado');
    if (a.kind === 'database') return [str('engine'), str('engine_version')].filter(Boolean).join(' ') || 'Motor no identificado';
    if (a.kind === 'function') return str('runtime') ?? 'Función';
    return '';
  }

  state(a: DiscoveredAsset): string | null {
    const s = a.attributes['state'] ?? a.attributes['status'];
    return typeof s === 'string' ? s : null;
  }
}
