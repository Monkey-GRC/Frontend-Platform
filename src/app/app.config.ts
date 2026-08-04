import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { credentialsInterceptor } from '@core/domain/interceptors/credentials.interceptor';
import { tenantCredentialsInterceptor } from '@core/domain/interceptors/tenant-credentials.interceptor';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([tenantCredentialsInterceptor, credentialsInterceptor])),
  ]
};
