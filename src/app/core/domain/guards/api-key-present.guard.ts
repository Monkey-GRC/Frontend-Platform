import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RegistrationSessionService } from '@core/domain/services/registration-session.service';

export const apiKeyPresentGuard: CanActivateFn = () => {
  const registrationSession = inject(RegistrationSessionService);
  const router = inject(Router);

  return registrationSession.apiKey() ? true : router.createUrlTree(['/register']);
};
