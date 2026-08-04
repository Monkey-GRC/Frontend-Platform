import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RegistrationSessionService } from '@core/domain/services/registration-session.service';

export const characterizationCompleteGuard: CanActivateFn = () => {
  const registrationSession = inject(RegistrationSessionService);
  const router = inject(Router);

  if (!registrationSession.onboardingCode()) {
    return router.createUrlTree(['/register']);
  }

  return registrationSession.characterizationDone()
    ? true
    : router.createUrlTree(['/onboarding/characterization']);
};
