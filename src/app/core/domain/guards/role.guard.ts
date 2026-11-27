import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { SessionService } from '@core/domain/services/session.service';

// Deja entrar solo a los roles dados; a los demás los manda al inicio. La barrera real es el backend (responde 403): esto evita mostrar una pantalla que no les toca.
export const roleGuard =
  (...roles: string[]): CanActivateFn =>
  () => {
    const role = inject(SessionService).user()?.role;
    return role && roles.includes(role) ? true : inject(Router).createUrlTree(['/']);
  };

// Elige entre dos pantallas de la misma dirección según el rol (la ruta que no coincide cae a la siguiente). La barrera real es el backend.
export const roleMatch =
  (...roles: string[]): CanMatchFn =>
  () => {
    const role = inject(SessionService).user()?.role;
    return !!role && roles.includes(role);
  };
