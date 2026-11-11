import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { AuthService } from '@core/domain/services/auth.service';

// El inverso de `authGuard`: las pantallas para quien NO ha entrado (inicio de sesión y activación). Con una sesión válida no se muestran:
// se vuelve a donde el cliente trabaja, así «atrás» o «adelante» del navegador no lo devuelven al login estando dentro.
// Quien aún no ha contado de qué trata su empresa va al onboarding, igual que al iniciar sesión.
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const session = inject(SessionService);
  const router = inject(Router);

  return authService.validate().pipe(
    map((hasSession) => {
      if (!hasSession) return true;
      return router.createUrlTree([session.onboarding()?.next_step === 'organizational_context' ? '/onboarding' : '/']);
    }),
  );
};
