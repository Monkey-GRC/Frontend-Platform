import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { AuthService } from '@core/domain/services/auth.service';

// Sin sesión válida se va al inicio de sesión. Quien todavía no tiene cuenta llega a la
// activación (canje de la clave) desde el enlace de esa pantalla.
//
// Con la sesión ya cargada en esta pestaña NO se vuelve a preguntar al servidor en cada cambio de pantalla: eso hacía esperar un viaje de red completo antes de abrir
// cualquier ruta protegida (se notaba al entrar y salir de Ajustes). El guard es solo comodidad: la autorización real es del backend en cada petición, y si la sesión
// venció, el interceptor renueva o manda al inicio de sesión en la primera llamada que falle.
export const authGuard: CanActivateFn = () => {
  if (inject(SessionService).isAuthenticated()) return true;

  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.validate().pipe(
    map((ok) => (ok ? true : router.createUrlTree(['/signin']))),
  );
};
