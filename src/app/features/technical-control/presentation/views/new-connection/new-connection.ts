import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ServiceService } from '@features/services/domain/services/service.service';
import { Breadcrumb, Crumb } from '@shared/presentation/components/breadcrumb/breadcrumb';
import { LoadingSpinner } from '@shared/presentation/components/loading-spinner/loading-spinner';
import { Capability, ConnectionMethod, Platform } from '../../../domain/models/technical-control.models';
import { TechnicalControlService } from '../../../domain/services/technical-control.service';
import { ProviderLogo } from '../../components/provider-logo/provider-logo';

type Stage = 'loading' | 'error' | 'ready';

// El marketplace de plataformas (D67): el cliente elige a qué quiere conectarse y eso lo lleva a su propio paso a paso. Las plataformas, su orden y
// si están disponibles salen del catálogo del backend; esta pantalla no fija ninguna. Las que aún no tienen flujo se muestran bloqueadas.
@Component({
  selector: 'app-new-connection',
  imports: [Breadcrumb, ProviderLogo, RouterLink, LoadingSpinner],
  templateUrl: './new-connection.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewConnectionView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TechnicalControlService);
  private readonly services = inject(ServiceService);

  readonly stage = signal<Stage>('loading');
  readonly serviceId = signal('');
  readonly serviceName = signal<string | null>(null);
  // Un grupo por tipo de conexión que aplica al escenario del servicio.
  readonly groups = signal<Capability[]>([]);

  // Mis servicios › {servicio} › Nueva conexión
  readonly crumbs = computed<Crumb[]>(() => [
    { label: 'Mis servicios', link: ['/services'] },
    { label: this.serviceName() ?? 'Servicio', link: ['/services', this.serviceId()] },
    { label: 'Nueva conexión' },
  ]);

  ngOnInit(): void {
    this.serviceId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.load();
  }

  load(): void {
    this.stage.set('loading');
    const id = this.serviceId();
    forkJoin({ state: this.api.state(id), service: this.services.get(id) }).subscribe({
      next: ({ state, service }) => {
        // Sin escenario no hay conexiones que proponer: se vuelve al servicio, donde se le pregunta dónde vive.
        if (!state.deployment_scenario) {
          this.router.navigate(['/services', id]);
          return;
        }
        this.serviceName.set(service.name);
        this.groups.set(state.applicable_capabilities.filter((c) => c.platforms.length > 0));
        this.stage.set('ready');
      },
      error: () => this.stage.set('error'),
    });
  }

  // Cómo se conecta, dicho sin jerga (philosophy.md): lo que el cliente va a hacer, no el nombre del mecanismo. El primer canal es el recomendado.
  describe(p: Platform): string {
    const how: Record<ConnectionMethod, string> = {
      readonly_role: 'Monkey revisa tu cuenta con un rol de solo lectura. No compartes contraseñas ni llaves.',
      access_keys: 'Monkey revisa tu cuenta con una llave de acceso de solo lectura.',
      agent: 'Instalas un programa ligero de Monkey en el equipo. No necesitas dar contraseñas.',
    };
    return p.availability === 'available' && p.connection_methods.length > 0 ? how[p.connection_methods[0]] : 'Estará disponible muy pronto.';
  }

  // El título del grupo es el nombre del tipo de conexión sin la aclaración entre paréntesis («Servicios en nube (gestionados, sin servidor)» → «Servicios en nube»).
  groupTitle(category: string): string {
    return category.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  }

  // Una tarjeta bloqueada no navega: se anuncia como no disponible y no hace nada.
  blockedLabel(name: string): string {
    return `${name}, no disponible, próximamente`;
  }
}
