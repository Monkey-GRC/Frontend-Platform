import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RegistrationSessionService } from '@core/domain/services/registration-session.service';

export const templateSelectedGuard: CanActivateFn = () => {
  const registrationSession = inject(RegistrationSessionService);
  const router = inject(Router);

  if (!registrationSession.onboardingCode()) {
    return router.createUrlTree(['/register']);
  }

  if (!registrationSession.characterizationDone()) {
    return router.createUrlTree(['/onboarding/characterization']);
  }

  return registrationSession.templateStepDone()
    ? true
    : router.createUrlTree(['/onboarding/templates']);
};
