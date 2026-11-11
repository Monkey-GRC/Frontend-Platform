import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/domain/services/language.service';
import { apiErrorMessage } from '@core/domain/utils/api-error';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { DataTable, TableCell, TableColumn } from '@shared/presentation/components/data-table/data-table';
import { OptionChips } from '@shared/presentation/components/option-chips/option-chips';
import { SideDrawer } from '@shared/presentation/components/side-drawer/side-drawer';
import { StatusIndicator, StatusTone } from '@shared/presentation/components/status-indicator/status-indicator';
import { TableToolbar } from '@shared/presentation/components/table-toolbar/table-toolbar';
import { Tag } from '@shared/presentation/components/tag/tag';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { Asset, DiscoveredAsset, DiscoveredAssetsPage } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';

const SERVICE_NAME: Record<string, string> = {
  ec2: 'TECHNICAL_CONTROL.ASSETS.SERVICE_NAME.EC2',
  rds: 'TECHNICAL_CONTROL.ASSETS.SERVICE_NAME.RDS',
  lambda: 'TECHNICAL_CONTROL.ASSETS.SERVICE_NAME.LAMBDA',
  s3: 'TECHNICAL_CONTROL.ASSETS.SERVICE_NAME.S3',
  timeout: 'TECHNICAL_CONTROL.ASSETS.SERVICE_NAME.TIMEOUT',
};
// Cómo se llama cada dato de un activo cuando se abre su detalle (claves de traducción). Lo que no está aquí no se muestra (no se vuelca lo que no se entiende).
const ATTRIBUTE_LABEL: Record<string, string> = {
  instance_id: 'TECHNICAL_CONTROL.ASSETS.ATTR.INSTANCE_ID',
  os: 'TECHNICAL_CONTROL.ASSETS.ATTR.OS',
  platform: 'TECHNICAL_CONTROL.ASSETS.ATTR.PLATFORM',
  architecture: 'TECHNICAL_CONTROL.ASSETS.ATTR.ARCHITECTURE',
  instance_type: 'TECHNICAL_CONTROL.ASSETS.ATTR.INSTANCE_TYPE',
  state: 'TECHNICAL_CONTROL.ASSETS.ATTR.STATE',
  private_ip: 'TECHNICAL_CONTROL.ASSETS.ATTR.PRIVATE_IP',
  public_ip: 'TECHNICAL_CONTROL.ASSETS.ATTR.PUBLIC_IP',
  availability_zone: 'TECHNICAL_CONTROL.ASSETS.ATTR.AVAILABILITY_ZONE',
  vpc_id: 'TECHNICAL_CONTROL.ASSETS.ATTR.VPC_ID',
  subnet_id: 'TECHNICAL_CONTROL.ASSETS.ATTR.SUBNET_ID',
  launched_at: 'TECHNICAL_CONTROL.ASSETS.ATTR.LAUNCHED_AT',
  engine: 'TECHNICAL_CONTROL.ASSETS.ATTR.ENGINE',
  engine_version: 'TECHNICAL_CONTROL.ASSETS.ATTR.ENGINE_VERSION',
  status: 'TECHNICAL_CONTROL.ASSETS.ATTR.STATUS',
  instance_class: 'TECHNICAL_CONTROL.ASSETS.ATTR.INSTANCE_CLASS',
  multi_az: 'TECHNICAL_CONTROL.ASSETS.ATTR.MULTI_AZ',
  encrypted: 'TECHNICAL_CONTROL.ASSETS.ATTR.ENCRYPTED',
  endpoint: 'TECHNICAL_CONTROL.ASSETS.ATTR.ENDPOINT',
  runtime: 'TECHNICAL_CONTROL.ASSETS.ATTR.RUNTIME',
  last_modified: 'TECHNICAL_CONTROL.ASSETS.ATTR.LAST_MODIFIED',
  created_at: 'TECHNICAL_CONTROL.ASSETS.ATTR.CREATED_AT',
};

// Los activos que la conexión reconoció en la cuenta del cliente (D61): se ven con lo que los distingue entre sí (nombre, identificador, IP, zona, etiquetas) y el
// cliente marca cuáles son de ESTE servicio; los demás quedan fuera de lo que se mide.
@Component({
  selector: 'app-discovered-assets',
  imports: [LoadingSpinner, TranslatePipe, DataTable, TableCell, TableToolbar, OptionChips, StatusIndicator, SideDrawer, Tag],
  templateUrl: './discovered-assets.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoveredAssets {
  private readonly api = inject(TechnicalControlService);
  private readonly catalogs = inject(CatalogService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly asset = input.required<Asset>();
  readonly serviceId = input.required<string>();
  // Volver a mirar la cuenta (vuelve a comprobar la conexión). Quien lo hace es la tarjeta de la conexión.
  readonly refreshing = input(false);
  /** ¿Se puede lanzar una evaluación desde aquí? Solo con la cuenta ya conectada. */
  readonly canEvaluate = input(false);
  /** Hay una evaluación en cola o en curso: el botón espera. */
  readonly evaluating = input(false);
  /** Pide evaluar ahora; la tarjeta del activo hace la llamada. */
  readonly evaluate = output<void>();
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
  readonly chips = computed(() => (this.page()?.summary ?? []).map((s) => ({ ...s, label: this.kindLabel(s.kind) })));
  /** Los filtros por tipo, cada uno con cuántos activos hay de ese tipo. */
  readonly kindChips = computed(() => this.chips().map((c) => ({ value: c.kind, label: `${c.label} (${c.count})` })));
  readonly total = computed(() => this.items().length);
  readonly incomplete = computed(() => (this.page()?.incomplete_services ?? []).map((s) => (SERVICE_NAME[s] ? this.translate.instant(SERVICE_NAME[s]) : s)).join(', '));
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
  /** Con algún activo ya guardado en el servicio, la tabla separa «En este servicio» de «Fuera del servicio»; si no hay ninguno, no hay separador. */
  readonly groupFn = computed<((a: DiscoveredAsset) => string) | null>(() => {
    const saved = this.original();
    return this.items().some((a) => saved.has(a.id)) ? (a) => (saved.has(a.id) ? 'in' : 'out') : null;
  });
  protected readonly groupLabel = (key: string): string => this.translate.instant(key === 'in' ? 'TECHNICAL_CONTROL.ASSETS.GROUP_IN' : 'TECHNICAL_CONTROL.ASSETS.GROUP_OUT');
  protected readonly columns: TableColumn<DiscoveredAsset>[] = [
    { key: 'name', headerKey: 'SERVICES.LIST.COL_NAME', class: 'max-w-[16rem]' },
    { key: 'identifier', headerKey: 'TECHNICAL_CONTROL.ASSETS.COL_ID' },
    { key: 'ip', headerKey: 'TECHNICAL_CONTROL.ASSETS.COL_PRIVATE_IP' },
    { key: 'kind', headerKey: 'TECHNICAL_CONTROL.LIST.COL_TYPE' },
    { key: 'detail', headerKey: 'TECHNICAL_CONTROL.LIST.COL_DETAIL' },
    { key: 'zone', headerKey: 'TECHNICAL_CONTROL.ASSETS.COL_ZONE' },
    { key: 'state', headerKey: 'TECHNICAL_CONTROL.LIST.COL_STATUS' },
    { key: 'inService', headerKey: 'TECHNICAL_CONTROL.ASSETS.COL_IN_SERVICE' },
  ];
  protected readonly assetKey = (a: DiscoveredAsset): string => a.id;
  protected readonly assetLabel = (a: DiscoveredAsset): string => a.name ?? a.code;

  /** La selección de la tabla (casillas de las filas y la de «marcar todo»): es lo que el cliente quiere incluir en el servicio. */
  protected onSelection(next: Set<string | number>): void {
    this.notice.set(null);
    this.selected.set(next as Set<string>);
  }

  readonly includedNow = computed(() => this.selected().size);
  readonly dirty = computed(() => {
    const now = this.selected();
    const before = this.original();
    return now.size !== before.size || [...now].some((id) => !before.has(id));
  });

  constructor() {
    // Cuando la conexión vuelve a comprobarse (cambia su última validación), la lista se vuelve a leer.
    effect(() => {
      void this.asset().provisioning.last_validated_at;
      this.serviceId();
      untracked(() => this.load());
    });
    // El backend traduce las opciones: al cambiar el idioma se vuelven a pedir, sin perder la selección que el cliente aún no guardó.
    effect(() => {
      this.language.current();
      untracked(() => this.loadCatalogs());
    });
  }

  private loadCatalogs(): void {
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
        this.notice.set({ kind: 'error', text: apiErrorMessage(error, this.translate.instant('TECHNICAL_CONTROL.ASSETS.SAVE_ERROR')) });
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
    if (a.kind === 'server') return str('os') ?? str('platform') ?? this.translate.instant('TECHNICAL_CONTROL.ASSETS.OS_UNKNOWN');
    if (a.kind === 'database') return [str('engine'), str('engine_version')].filter(Boolean).join(' ') || this.translate.instant('TECHNICAL_CONTROL.ASSETS.ENGINE_UNKNOWN');
    if (a.kind === 'function') return str('runtime') ?? this.translate.instant('TECHNICAL_CONTROL.ASSETS.FUNCTION');
    return '';
  }

  // El estado se dice en el idioma del cliente, con su punto de estado.
  state(a: DiscoveredAsset): string | null {
    const s = a.attributes['state'] ?? a.attributes['status'];
    return typeof s === 'string' ? s : null;
  }

  stateLabel(state: string): string {
    const key = `TECHNICAL_CONTROL.ASSETS.STATE.${state.toUpperCase().replace(/-/g, '_')}`;
    const text = this.translate.instant(key);
    return text === key ? state : text;
  }

  /** Lo que funciona es `ok`, lo apagado `neutral` y lo que está cambiando `warn`; el texto del estado va siempre junto al punto. */
  stateTone(state: string): StatusTone {
    if (['running', 'available', 'active'].includes(state)) return 'ok';
    if (['stopped', 'terminated'].includes(state)) return 'neutral';
    return 'warn';
  }

  // Los datos del panel de detalle, con nombre legible y el valor dicho en el idioma del cliente.
  updatedAt(value: string): string {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString(this.language.current(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  detailRows(a: DiscoveredAsset): { label: string; value: string }[] {
    return Object.entries(ATTRIBUTE_LABEL)
      .filter(([key]) => a.attributes[key] !== undefined && a.attributes[key] !== null && a.attributes[key] !== '')
      .map(([key, label]) => ({ label: this.translate.instant(label), value: this.format(key, a.attributes[key]) }));
  }

  private format(key: string, value: string | number | boolean | null): string {
    if (typeof value === 'boolean') return this.translate.instant(value ? 'TECHNICAL_CONTROL.ASSETS.YES' : 'TECHNICAL_CONTROL.ASSETS.NO');
    if (key === 'state' || key === 'status') return this.stateLabel(String(value));
    if (key === 'launched_at' || key === 'created_at' || key === 'last_modified') {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(this.language.current(), { dateStyle: 'medium', timeStyle: 'short' });
    }
    return String(value);
  }
}
