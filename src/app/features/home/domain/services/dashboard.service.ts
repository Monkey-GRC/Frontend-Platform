import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { Dashboard, DashboardAttention, DashboardFramework, DashboardServiceSummary } from '../models/dashboard.models';

interface Page<T> {
  items: T[];
  total: number;
}
interface ServiceRef {
  id: string;
  name: string;
}
interface OverviewDto {
  frameworks: Array<{
    framework_code: string;
    name: string;
    readiness: string;
    progress: { done: number; total: number };
    coverage: { measured: number; applicable: number };
    categories: Array<{ failing_controls: Array<{ control_id: string; code: string; name: string }> }>;
    technical?: { state: string };
  }>;
}

// Junta, con los endpoints que ya existen, lo que el Inicio necesita: los servicios de la empresa y, de cada uno, sus activos, riesgos, causas y su resumen de cumplimiento.
// Son pocas llamadas por servicio (una empresa tiene pocos); si un servicio crece, un endpoint propio del Inicio lo reemplazaría. Lo que no se pueda leer de un servicio
// se queda en cero o vacío en vez de tumbar todo el panel: el resto sigue siendo cierto.
@Injectable({ providedIn: 'root' })
export class HomeDashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** `technical` pide la vista técnica del resumen (solo el administrador de la empresa y el auditor la reciben). */
  load(technical: boolean): Observable<Dashboard> {
    return this.page<ServiceRef>(`${this.base}/services`, { page: 1, page_size: 100 }).pipe(
      switchMap((services) => (services.items.length === 0 ? of({ services: [] } as Dashboard) : forkJoin(services.items.map((s) => this.service(s, technical))).pipe(map((list) => ({ services: list }))))),
    );
  }

  private service(ref: ServiceRef, technical: boolean): Observable<DashboardServiceSummary> {
    const one = { page: 1, page_size: 1 };
    const total = (url: string, extra: Record<string, string | number | boolean> = {}) =>
      this.page<unknown>(url, { ...one, ...extra }).pipe(map((p) => p.total), catchError(() => of(0)));
    return forkJoin({
      assets: total(`${this.base}/assets`, { service_id: ref.id }),
      risks: total(`${this.base}/services/${ref.id}/risks`),
      evaluated: total(`${this.base}/services/${ref.id}/risks`, { evaluated: true }),
      causes: total(`${this.base}/services/${ref.id}/causes`),
      overview: this.overview(ref.id, technical),
    }).pipe(
      map(({ assets, risks, evaluated, causes, overview }) => {
        const frameworks: DashboardFramework[] = (overview?.frameworks ?? []).map((f) => ({
          code: f.framework_code, name: f.name, readiness: f.readiness, verdict: f.technical?.state ?? null, progress: f.progress, coverage: f.coverage,
        }));
        const failing = new Map<string, DashboardAttention>();
        for (const f of overview?.frameworks ?? []) for (const c of f.categories) for (const x of c.failing_controls) failing.set(x.control_id, { controlId: x.control_id, code: x.code, name: x.name });
        return {
          id: ref.id, name: ref.name, frameworks, assets, risks, risksEvaluated: evaluated, causes,
          controls: frameworks.reduce((n, f) => Math.max(n, f.progress.total), 0),
          failing: [...failing.values()],
        };
      }),
    );
  }

  private overview(serviceId: string, technical: boolean): Observable<OverviewDto | null> {
    const params = technical ? new HttpParams().set('view', 'technical') : undefined;
    return this.http.get<SuccessResponse<OverviewDto>>(`${this.base}/services/${serviceId}/compliance-overview`, { params }).pipe(map((r) => r.data ?? null), catchError(() => of(null)));
  }

  private page<T>(url: string, query: Record<string, string | number | boolean>): Observable<Page<T>> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) params = params.set(k, String(v));
    return this.http.get<SuccessResponse<Page<T>>>(url, { params }).pipe(map((r) => r.data ?? { items: [], total: 0 }));
  }
}
