import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '@features/auth/domain/services/auth.service';

// Sin sesión válida se va al inicio de sesión. Quien todavía no tiene cuenta llega a la
// activación (canje de la clave) desde el enlace de esa pantalla.
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.validate().pipe(
    map((ok) => (ok ? true : router.createUrlTree(['/signin']))),
  );
};
