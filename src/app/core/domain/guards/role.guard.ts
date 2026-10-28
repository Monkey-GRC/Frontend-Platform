import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '@core/domain/services/session.service';

// Deja entrar solo a los roles dados; a los demás los manda al inicio. La barrera real es el backend (responde 403): esto evita mostrar una pantalla que no les toca.
export const roleGuard =
  (...roles: string[]): CanActivateFn =>
  () => {
    const role = inject(SessionService).user()?.role;
    return role && roles.includes(role) ? true : inject(Router).createUrlTree(['/']);
  };
