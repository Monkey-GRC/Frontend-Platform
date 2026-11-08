import { Injectable, computed, inject } from '@angular/core';
import { SessionService } from '@core/domain/services/session.service';
import { TECHNICAL_VIEW_ROLES } from '../models/compliance.models';

// Qué ve cada rol en Cumplimiento. La vista técnica (códigos, dimensiones, requisitos) NO es un modo que el cliente active:
// es la pantalla de los roles `auditor` y `admin_empresa` (D63, D81, D96). El rol sale de la sesión, y el backend lo vuelve a comprobar
// en cada petición. Las vistas de Cumplimiento consumen `viewParam` para pedir `?view=technical` solo cuando corresponde.
@Injectable({ providedIn: 'root' })
export class ComplianceViewService {
  private readonly session = inject(SessionService);

  readonly role = computed(() => this.session.user()?.role ?? null);

  readonly isTechnicalView = computed(() => {
    const role = this.role();
    return role !== null && TECHNICAL_VIEW_ROLES.includes(role);
  });

  /** Valor del parámetro `view` de la API: `technical` para el auditor y el administrador; para el resto no se envía. */
  readonly viewParam = computed(() => (this.isTechnicalView() ? ('technical' as const) : undefined));

  /** Solo el administrador de la empresa abre la pantalla de administración del servicio (editarlo, conexiones); el responsable, el delegado y el auditor solo leen su Cumplimiento. */
  readonly canOpenService = computed(() => this.role() === 'admin_empresa');

  /** Solo el administrador de la empresa crea, vincula y da de baja riesgos y causas; el resto de roles solo lee (compliance-risks.md → «Quién puede qué»). */
  readonly canManage = computed(() => this.role() === 'admin_empresa');
}
