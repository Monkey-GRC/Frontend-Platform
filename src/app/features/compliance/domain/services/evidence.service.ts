import { HttpClient, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { requireData, unwrapData } from '@shared/domain/utils/unwrap-response';
import { EvidenceDisposition, EvidenceDownload, EvidenceRequirement, EvidenceSubmission, EvidenceTestList, EvidenceUploadEvent, ServiceEvidenceRequirement } from '../models/evidence.models';

// Evidencias de un control. Los endpoints son los del contrato (MD-126, MD-127); mientras el backend no los tenga, `list` falla con 404 y quien lo usa
// cae al resumen que ya trae el detalle del control.
@Injectable({ providedIn: 'root' })
export class EvidenceService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Las evidencias requeridas del control, cada una con sus entregas. */
  list(controlId: string, view?: 'technical'): Observable<EvidenceRequirement[]> {
    const params = view ? new HttpParams().set('view', view) : undefined;
    return this.http
      .get<SuccessResponse<{ items: EvidenceRequirement[] }>>(`${this.base}/controls/${controlId}/evidence`, { params })
      .pipe(map((r) => r.data?.items ?? []));
  }

  /** La evidencia de todos los controles del servicio en una sola petición (sin paginar). */
  listByService(serviceId: string, view?: 'technical'): Observable<ServiceEvidenceRequirement[]> {
    const params = view ? new HttpParams().set('view', view) : undefined;
    return this.http
      .get<SuccessResponse<{ items: ServiceEvidenceRequirement[] }>>(`${this.base}/services/${serviceId}/evidence`, { params })
      .pipe(map((r) => r.data?.items ?? []));
  }

  /** Los dos POST emiten el avance de la subida y, al final, la entrega; cancelar la suscripción aborta la petición. */
  private post(url: string, body: FormData): Observable<EvidenceUploadEvent> {
    return this.http.post<SuccessResponse<EvidenceSubmission>>(url, body, { observe: 'events', reportProgress: true }).pipe(
      filter((e: HttpEvent<SuccessResponse<EvidenceSubmission>>) => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
      map((e): EvidenceUploadEvent => {
        if (e.type === HttpEventType.UploadProgress) return { kind: 'progress', percent: e.total ? Math.round((e.loaded / e.total) * 100) : null };
        return { kind: 'done', submission: requireData((e as { body: SuccessResponse<EvidenceSubmission> }).body) };
      }),
    );
  }

  /** Sube el archivo como la evidencia de UNA prueba documental en este control (D88). La primera vez crea el lugar de esa prueba; las siguientes son versiones nuevas. */
  uploadForTest(controlId: string, testId: string, file: File, occurrenceId?: string | null): Observable<EvidenceUploadEvent> {
    const body = new FormData();
    body.append('file', file, file.name);
    // DT-115 · La evidencia de un requisito «cuando ocurra» se entrega por caso.
    if (occurrenceId) body.append('occurrence_id', occurrenceId);
    return this.post(`${this.base}/controls/${controlId}/tests/${testId}/evidence`, body);
  }

  /** Sube el archivo como una evidencia entregada nueva (una versión más) del requerimiento. */
  upload(requirementId: string, file: File): Observable<EvidenceUploadEvent> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.post(`${this.base}/evidence-requirements/${requirementId}/submissions`, body);
  }

  /** La evidencia de UNA prueba manual y los otros controles a los que también aplica (D85). */
  listForTest(controlId: string, testId: string, view?: 'technical'): Observable<EvidenceTestList> {
    const params = view ? new HttpParams().set('view', view) : undefined;
    return this.http
      .get<SuccessResponse<EvidenceTestList>>(`${this.base}/controls/${controlId}/tests/${testId}/evidence`, { params })
      .pipe(map((r) => ({ test_id: r.data?.test_id ?? testId, shared_with: r.data?.shared_with ?? [], items: r.data?.items ?? [] })));
  }

  /** Un enlace temporal (5 minutos) para ver (`inline`, solo PDF/PNG/JPG) o bajar (`attachment`) una evidencia entregada: el archivo nunca es público. */
  download(submissionId: string, disposition: EvidenceDisposition = 'attachment'): Observable<EvidenceDownload> {
    const params = new HttpParams().set('disposition', disposition);
    return this.http.get<SuccessResponse<EvidenceDownload>>(`${this.base}/evidence-submissions/${submissionId}/download`, { params }).pipe(unwrapData());
  }
}
