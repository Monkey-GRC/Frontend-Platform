import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BRAND_ICONS } from './brand-icons';

// Una ayuda visual para reconocer de un vistazo el sistema operativo (o el motor de base de datos) de un activo. Cada logo va sobre una pastilla
// blanca para que se lea igual en modo claro y oscuro. Si no se sabe qué es, se dice con un icono neutro (no se inventa).
const FAMILIES: [RegExp, string][] = [
  [/ubuntu/i, 'ubuntu'],
  [/amazon linux/i, 'amazon'],
  [/debian/i, 'debian'],
  [/red hat|rhel/i, 'redhat'],
  [/centos/i, 'centos'],
  [/rocky/i, 'rockylinux'],
  [/alma/i, 'almalinux'],
  [/suse|sles/i, 'suse'],
  [/fedora/i, 'fedora'],
  [/aurora|postgres/i, 'postgresql'],
  [/mariadb/i, 'mariadb'],
  [/mysql/i, 'mysql'],
  [/oracle/i, 'oracle'],
  [/mongo/i, 'mongodb'],
  [/linux/i, 'linux'],
];

@Component({
  selector: 'app-os-icon',
  templateUrl: './os-icon.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OsIcon {
  readonly name = input<string | null>(null);

  readonly windows = computed(() => /windows/i.test(this.name() ?? ''));
  readonly brand = computed(() => {
    const n = this.name() ?? '';
    const key = FAMILIES.find(([re]) => re.test(n))?.[1];
    return key ? BRAND_ICONS[key] : null;
  });
}
