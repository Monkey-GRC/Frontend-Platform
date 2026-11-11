import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SessionService } from '@core/domain/services/session.service';

// El servicio de Cumplimiento que está activo: se elige con el selector del encabezado y se recuerda al pasar de una sección a otra. Es estado de presentación
// de la sesión (un signal); no se guarda en ningún sitio ni toca el backend. Pertenece a quien inició sesión: si entra otra persona, vuelve a no haber ninguno.
@Injectable({ providedIn: 'root' })
export class ActiveComplianceService {
  private readonly session = inject(SessionService);
  private readonly stored = signal<{ userId: string; serviceId: string } | null>(null);

  /** El id del servicio activo; `null` mientras no se haya elegido (el encabezado entonces toma el primero de la lista). */
  readonly serviceId = computed(() => {
    const value = this.stored();
    return value && value.userId === this.session.user()?.id ? value.serviceId : null;
  });

  constructor() {
    // Al cerrar sesión no queda nada: quien vuelva a entrar, aunque sea la misma persona, empieza sin servicio activo.
    effect(() => {
      if (this.session.user() === null) this.stored.set(null);
    });
  }

  set(serviceId: string | null): void {
    const userId = this.session.user()?.id;
    this.stored.set(serviceId && userId ? { userId, serviceId } : null);
  }
}
