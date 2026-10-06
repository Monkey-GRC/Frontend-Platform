import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { Service, ServiceInput, ServicePage } from '../models/service.models';

// Los servicios de la empresa (Componente 2 del onboarding). El backend clona el catálogo al
// crearlos; aquí solo se habla con su API.
@Injectable({ providedIn: 'root' })
export class ServiceService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/services`;

  list(page = 1, pageSize = 50): Observable<ServicePage> {
    const params = new HttpParams().set('page', page).set('page_size', pageSize);
    return this.http.get<SuccessResponse<ServicePage>>(this.url, { params }).pipe(map((r) => r.data!));
  }

  get(id: string): Observable<Service> {
    return this.http.get<SuccessResponse<Service>>(`${this.url}/${id}`).pipe(map((r) => r.data!));
  }

  create(input: ServiceInput): Observable<Service> {
    return this.http.post<SuccessResponse<Service>>(this.url, input).pipe(map((r) => r.data!));
  }

  update(id: string, input: Partial<ServiceInput>): Observable<Service> {
    return this.http.patch<SuccessResponse<Service>>(`${this.url}/${id}`, input).pipe(map((r) => r.data!));
  }

  // Sube el archivo de la Descripción del Sistema (PDF o .docx, máx. 25 MB). Va aparte del servicio: el
  // archivo necesita que el servicio ya exista. Reemplaza al anterior; el enlace, si lo hay, se conserva.
  uploadSystemDescription(id: string, file: File): Observable<Service> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http
      .post<SuccessResponse<Service>>(`${this.url}/${id}/system-description/file`, body)
      .pipe(map((r) => r.data!));
  }

  // Enlace temporal (5 min) para descargar el archivo que subió el cliente.
  systemDescriptionDownload(id: string): Observable<{ url: string; file_name: string; expires_in: number }> {
    return this.http
      .get<SuccessResponse<{ url: string; file_name: string; expires_in: number }>>(
        `${this.url}/${id}/system-description/file`,
      )
      .pipe(map((r) => r.data!));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<SuccessResponse>(`${this.url}/${id}`).pipe(map(() => undefined));
  }
}
