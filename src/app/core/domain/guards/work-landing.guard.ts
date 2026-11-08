import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '@core/domain/services/session.service';

// D102 · «Mi trabajo» es la pantalla de entrada del responsable y del delegado (MD-196): el inicio de la empresa es del administrador y del auditor.
// Va en la ruta de inicio, así también cubre el enlace del logo y el redireccionamiento tras el inicio de sesión. La barrera real es el backend.
export const workLandingGuard: CanActivateFn = () => {
  const role = inject(SessionService).user()?.role;
  return role === 'responsable' || role === 'delegado' ? inject(Router).createUrlTree(['/mi-trabajo']) : true;
};
