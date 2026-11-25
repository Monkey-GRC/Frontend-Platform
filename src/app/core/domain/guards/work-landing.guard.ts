import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '@core/domain/services/session.service';
import { landingPath } from '@shared/domain/utils/roles';

// D102 · «Mi trabajo» es la pantalla de entrada del responsable y del delegado (MD-196); D136 · la del colaborador es «Mis documentos»: el inicio de la empresa es del administrador y del auditor.
// Va en la ruta de inicio, así también cubre el enlace del logo y el redireccionamiento tras el inicio de sesión. La barrera real es el backend.
export const workLandingGuard: CanActivateFn = () => {
  const target = landingPath(inject(SessionService).user()?.role);
  return target === '/' ? true : inject(Router).createUrlTree([target]);
};
