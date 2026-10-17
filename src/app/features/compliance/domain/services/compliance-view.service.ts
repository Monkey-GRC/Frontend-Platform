import { Injectable, computed, inject } from '@angular/core';
import { SessionService } from '@core/domain/services/session.service';
import { TECHNICAL_VIEW_ROLES } from '../models/compliance.models';

// Qué ve cada rol en Cumplimiento. La vista técnica (códigos, dimensiones, requisitos) NO es un modo que el cliente active:
// es la pantalla de los roles `auditor` y `consultor` (D63, D64). El rol sale de la sesión, y el backend lo vuelve a comprobar
// en cada petición. Las vistas de Cumplimiento consumen `viewParam` para pedir `?view=technical` solo cuando corresponde.
@Injectable({ providedIn: 'root' })
export class ComplianceViewService {
  private readonly session = inject(SessionService);

  readonly role = computed(() => this.session.user()?.role ?? null);

  readonly isTechnicalView = computed(() => {
    const role = this.role();
    return role !== null && TECHNICAL_VIEW_ROLES.includes(role);
  });

  /** Valor del parámetro `view` de la API: `technical` para auditor y consultor; para el resto no se envía. */
  readonly viewParam = computed(() => (this.isTechnicalView() ? ('technical' as const) : undefined));

  /** Solo el administrador de la empresa puede abrir la pantalla del servicio (la API de servicios es suya). */
  readonly canOpenService = computed(() => this.role() === 'admin_empresa');

  /** Solo el administrador de la empresa crea, vincula y da de baja riesgos y causas; el resto de roles solo lee (compliance-risks.md → «Quién puede qué»). */
  readonly canManage = computed(() => this.role() === 'admin_empresa');

  /** Solo el consultor decide una exclusión: quien se evalúa no aprueba lo que se le deja de medir (D78). */
  readonly canDecide = computed(() => this.role() === 'consultor');
}
