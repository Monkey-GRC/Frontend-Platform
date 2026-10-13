import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpBackend, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { MultiTranslateHttpLoader } from 'ngx-translate-multi-http-loader';
import { credentialsInterceptor } from '@core/domain/interceptors/credentials.interceptor';
import { LanguageService } from '@core/domain/services/language.service';

import { routes } from './app.routes';

// Un archivo por área en `public/i18n/{es,en}/`. Se carga con HttpBackend a propósito: así no pasa
// por `credentialsInterceptor` y no necesita sesión (el login ya se muestra traducido).
export const I18N_FILES = ['common', 'shell', 'home', 'auth', 'onboarding', 'services', 'technical-control', 'compliance'] as const;

export function httpLoaderFactory(httpBackend: HttpBackend): MultiTranslateHttpLoader {
  return new MultiTranslateHttpLoader(
    httpBackend,
    I18N_FILES.map((file) => ({ prefix: './i18n/', suffix: `/${file}.json` })),
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([credentialsInterceptor])),
    provideTranslateService({
      loader: { provide: TranslateLoader, useFactory: httpLoaderFactory, deps: [HttpBackend] },
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
  ]
};
