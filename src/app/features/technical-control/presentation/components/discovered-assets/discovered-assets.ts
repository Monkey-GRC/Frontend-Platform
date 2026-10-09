import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { Asset, DiscoveredAsset, DiscoveredAssetsPage } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';
import { OsIcon } from '../os-icon/os-icon';

const KIND_ICON: Record<string, string> = { server: 'dns', database: 'database', storage: 'folder_open', function: 'function', other: 'category' };
const SERVICE_NAME: Record<string, string> = { ec2: 'servidores', rds: 'bases de datos', lambda: 'funciones', s3: 'almacenamiento', timeout: 'algunos servicios (tardaron demasiado)' };
// Cómo se llama cada dato de un activo cuando se abre su detalle. Lo que no está aquí no se muestra (no se vuelca lo que no se entiende).
const ATTRIBUTE_LABEL: Record<string, string> = {
  instance_id: 'ID de la instancia',
  os: 'Sistema operativo',
  platform: 'Plataforma',
  architecture: 'Arquitectura',
  instance_type: 'Tipo de instancia',
  state: 'Estado',
  private_ip: 'IP privada',
  public_ip: 'IP pública',
  availability_zone: 'Zona de disponibilidad',
  vpc_id: 'Red (VPC)',
  subnet_id: 'Subred',
  launched_at: 'Creado',
  engine: 'Motor',
  engine_version: 'Versión del motor',
  status: 'Estado',
  instance_class: 'Clase de instancia',
  multi_az: 'Varias zonas',
  encrypted: 'Cifrada',
  endpoint: 'Dirección',
  runtime: 'Runtime',
  last_modified: 'Última modificación',
  created_at: 'Creado',
};

// Los activos que la conexión reconoció en la cuenta del cliente (D61): se ven con lo que los distingue entre sí (nombre, identificador, IP, zona, etiquetas) y el
// cliente marca cuáles son de ESTE servicio; los demás quedan fuera de lo que se mide.
@Component({
  selector: 'app-discovered-assets',
  imports: [DatePipe, OsIcon, LoadingSpinner],
  templateUrl: './discovered-assets.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoveredAssets implements OnInit {
  private readonly api = inject(TechnicalControlService);
  private readonly catalogs = inject(CatalogService);

  readonly asset = input.required<Asset>();
  readonly serviceId = input.required<string>();
  // Volver a mirar la cuenta (vuelve a comprobar la conexión). Quien lo hace es la tarjeta de la conexión.
  readonly refreshing = input(false);
  // En modo demostración la conexión se «comprueba» sin tocar la cuenta: no hay descubrimiento, y se dice (no se deja creer que falta algo).
  readonly probeMode = input<string>('unavailable');
  readonly refreshRequested = output<void>();

  readonly page = signal<DiscoveredAssetsPage | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly kind = signal<string | null>(null);
  readonly query = signal('');
  readonly selected = signal<ReadonlySet<string>>(new Set());
  private readonly original = signal<ReadonlySet<string>>(new Set());
  readonly saving = signal(false);
  readonly notice = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);
  readonly detail = signal<DiscoveredAsset | null>(null);
  private readonly kinds = signal<CatalogOption[]>([]);
  private readonly criticalities = signal<CatalogOption[]>([]);

  readonly items = computed(() => this.page()?.items ?? []);
  readonly chips = computed(() => (this.page()?.summary ?? []).map((s) => ({ ...s, label: this.kindLabel(s.kind), icon: KIND_ICON[s.kind] ?? 'category' })));
  readonly total = computed(() => this.items().length);
  readonly incomplete = computed(() => (this.page()?.incomplete_services ?? []).map((s) => SERVICE_NAME[s] ?? s).join(', '));
  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const saved = this.original();
    return this.items()
      .filter(
        (a) =>
          (!this.kind() || a.kind === this.kind()) &&
          (!q || [a.name, a.code, this.identifier(a), a.ip_address, a.platform, ...a.tags].some((v) => (v ?? '').toLowerCase().includes(q))),
      )
      // Los del servicio (ya guardados) arriba y los demás abajo. Se ordena por lo guardado, no por lo marcado: si no, la fila saltaría al marcarla.
      .sort((a, b) => Number(saved.has(b.id)) - Number(saved.has(a.id)));
  });
  // La primera fila de «los demás», solo si arriba hay alguna del servicio: ahí va la línea que separa los dos grupos.
  readonly firstOutsideId = computed(() => {
    const saved = this.original();
    const rows = this.visible();
    return rows.some((a) => saved.has(a.id)) ? (rows.find((a) => !saved.has(a.id))?.id ?? null) : null;
  });
  readonly includedNow = computed(() => this.selected().size);
  readonly dirty = computed(() => {
    const now = this.selected();
    const before = this.original();
    return now.size !== before.size || [...now].some((id) => !before.has(id));
  });
  readonly allVisibleSelected = computed(() => this.visible().length > 0 && this.visible().every((a) => this.selected().has(a.id)));
  readonly someVisibleSelected = computed(() => this.visible().some((a) => this.selected().has(a.id)) && !this.allVisibleSelected());

  constructor() {
    // Cuando la conexión vuelve a comprobarse (cambia su última validación), la lista se vuelve a leer.
    effect(() => {
      this.asset().provisioning.last_validated_at;
      this.serviceId();
      untracked(() => this.load());
    });
  }

  ngOnInit(): void {
    this.catalogs.options('resource_kind').subscribe((o) => this.kinds.set(o));
    this.catalogs.options('asset_criticality').subscribe((o) => this.criticalities.set(o));
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.listDiscovered(this.asset().id, this.serviceId()).subscribe({
      next: (page) => {
        this.page.set(page);
        const included = new Set(page.items.filter((a) => a.in_service).map((a) => a.id));
        this.original.set(included);
        this.selected.set(new Set(included));
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  // ---- selección ----
  toggle(id: string): void {
    this.notice.set(null);
    this.selected.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  toggleVisible(): void {
    this.notice.set(null);
    const all = this.allVisibleSelected();
    this.selected.update((s) => {
      const next = new Set(s);
      for (const a of this.visible()) all ? next.delete(a.id) : next.add(a.id);
      return next;
    });
  }

  discard(): void {
    this.selected.set(new Set(this.original()));
    this.notice.set(null);
  }

  save(): void {
    this.saving.set(true);
    this.notice.set(null);
    this.api.setServiceAssets(this.serviceId(), this.asset().id, [...this.selected()]).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.original.set(new Set(this.selected()));
        this.page.update((p) => (p ? { ...p, included_count: r.included, items: p.items.map((a) => ({ ...a, in_service: this.selected().has(a.id) })) } : p));
      },
      error: (error) => {
        this.saving.set(false);
        this.notice.set({ kind: 'error', text: apiErrorMessage(error, 'No pudimos guardar los activos del servicio. Inténtalo de nuevo.') });
      },
    });
  }

  // ---- cómo se ve cada activo ----
  pick(kind: string): void {
    this.kind.set(this.kind() === kind ? null : kind);
  }

  kindLabel(kind: string): string {
    return this.kinds().find((k) => k.value === kind)?.label ?? kind;
  }

  icon(kind: string): string {
    return KIND_ICON[kind] ?? 'category';
  }

  criticalityLabel(value: string): string {
    return this.criticalities().find((c) => c.value === value)?.label ?? value;
  }

  // Lo que distingue a un servidor de otro igual: su identificador en la nube (o, si no tiene, la dirección o el último tramo de su nombre).
  identifier(a: DiscoveredAsset): string {
    const at = a.attributes;
    const text = (k: string) => (typeof at[k] === 'string' && at[k] ? (at[k] as string) : null);
    return text('instance_id') ?? text('endpoint') ?? '';
  }

  // El texto de «Detalle»: el sistema operativo de un servidor o el motor y la versión de una base de datos.
  detailText(a: DiscoveredAsset): string {
    const at = a.attributes;
    const str = (k: string) => (typeof at[k] === 'string' && at[k] ? (at[k] as string) : null);
    if (a.kind === 'server') return str('os') ?? str('platform') ?? 'Sistema operativo no identificado';
    if (a.kind === 'database') return [str('engine'), str('engine_version')].filter(Boolean).join(' ') || 'Motor no identificado';
    if (a.kind === 'function') return str('runtime') ?? 'Función';
    return '';
  }

  iconOf(a: DiscoveredAsset): string | null {
    const at = a.attributes;
    if (a.kind === 'server') return typeof at['os'] === 'string' ? (at['os'] as string) : typeof at['platform'] === 'string' ? (at['platform'] as string) : null;
    if (a.kind === 'database') return typeof at['engine'] === 'string' ? (at['engine'] as string) : null;
    return null;
  }

  hasIcon(a: DiscoveredAsset): boolean {
    return a.kind === 'server' || a.kind === 'database';
  }

  // El estado se dice como lo dice AWS pero en español, con color: verde lo que funciona, gris lo apagado, ámbar lo que está cambiando.
  state(a: DiscoveredAsset): string | null {
    const s = a.attributes['state'] ?? a.attributes['status'];
    return typeof s === 'string' ? s : null;
  }

  stateLabel(state: string): string {
    const known: Record<string, string> = { running: 'En ejecución', stopped: 'Detenido', stopping: 'Deteniéndose', pending: 'Iniciando', 'shutting-down': 'Apagándose', available: 'Disponible' };
    return known[state] ?? state;
  }

  stateTone(state: string): { icon: string; text: string } {
    if (['running', 'available', 'active'].includes(state)) return { icon: 'check_circle', text: 'text-green-700 dark:text-green-300' };
    if (['stopped', 'terminated'].includes(state)) return { icon: 'do_not_disturb_on', text: 'text-gray-700 dark:text-gray-200' };
    return { icon: 'schedule', text: 'text-amber-700 dark:text-amber-300' };
  }

  // Los datos del panel de detalle, con nombre legible y el valor dicho en español.
  detailRows(a: DiscoveredAsset): { label: string; value: string }[] {
    return Object.entries(ATTRIBUTE_LABEL)
      .filter(([key]) => a.attributes[key] !== undefined && a.attributes[key] !== null && a.attributes[key] !== '')
      .map(([key, label]) => ({ label, value: this.format(key, a.attributes[key]) }));
  }

  private format(key: string, value: string | number | boolean | null): string {
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (key === 'state' || key === 'status') return this.stateLabel(String(value));
    if (key === 'launched_at' || key === 'created_at' || key === 'last_modified') {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
    }
    return String(value);
  }
}
