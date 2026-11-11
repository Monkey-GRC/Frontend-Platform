import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { storedLanguage } from '@core/domain/services/language.service';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { CatalogName, CatalogOption, FrameworkOption, RegulationOption } from '@shared/domain/models/catalog.models';

// Las opciones de los formularios salen del backend. Cada lista se pide una sola vez por
// sesión de la app y se reutiliza (no cambian mientras el cliente llena el formulario).
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/catalogs`;
  private readonly cache = new Map<string, Observable<unknown[]>>();

  options(name: CatalogName): Observable<CatalogOption[]> {
    return this.items<CatalogOption>(name);
  }

  regulations(): Observable<RegulationOption[]> {
    return this.items<RegulationOption>('regulations');
  }

  frameworks(): Observable<FrameworkOption[]> {
    return this.items<FrameworkOption>('frameworks');
  }

  // Los marcos que Monkey Admin contrató para la empresa del cliente (D47). A diferencia de las demás
  // listas, depende de quién esté en sesión: no se guarda en caché entre sesiones.
  contractedFrameworks(): Observable<FrameworkOption[]> {
    return this.http
      .get<SuccessResponse<{ items: FrameworkOption[] }>>(`${this.baseUrl}/contracted-frameworks`)
      .pipe(map((res) => res.data?.items ?? []));
  }

  private items<T>(name: string): Observable<T[]> {
    // El backend traduce las etiquetas según `Accept-Language`: la caché es por idioma.
    const key = `${storedLanguage()}:${name}`;
    let request = this.cache.get(key);
    if (!request) {
      request = this.http.get<SuccessResponse<{ items: T[] }>>(`${this.baseUrl}/${name}`).pipe(
        map((res) => res.data?.items ?? []),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.cache.set(key, request);
    }
    return request as Observable<T[]>;
  }
}
