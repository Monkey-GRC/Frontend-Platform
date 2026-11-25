import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { PageInfo } from '@shared/domain/models/page-info.model';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import {
  DocumentAcceptanceReceipt,
  DocumentDetail,
  DocumentFileLink,
  DocumentFilters,
  DocumentListItem,
  DocumentVersion,
  FileDisposition,
  MyDocument,
  PublishVersionDto,
} from '../models/document.models';

interface PageDto<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface Page<T> {
  items: T[];
  page: PageInfo;
}

const toPage = <T>(dto: PageDto<T>): Page<T> => ({ items: dto.items, page: { page: dto.page, pageSize: dto.page_size, total: dto.total, totalPages: dto.total_pages } });

/** Las páginas de 100 (el máximo del contrato) que hacen falta para tener todo lo de «Mis documentos»; una persona tiene unas decenas, no miles. */
const MINE_PAGE_SIZE = 100;
const MINE_MAX_PAGES = 10;

// Documentos de la empresa y «Mis documentos» (contracts/documentos.md, MD-503). La sesión, el idioma y los errores los resuelven los interceptores globales.
@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/documents`;
  private readonly mineUrl = `${environment.apiUrl}/me/documents`;
  private readonly catalogs = inject(CatalogService);

  /**
   * Las opciones de un enum del catálogo maestro que usa Documentos (`document_type`, `document_acceptance`, `my_document_status`), con su etiqueta en el idioma de la sesión: `GET /v1/catalogs/{name}`.
   * Las pide `CatalogService` (una vez por idioma); ninguna lista se escribe a mano.
   */
  catalog(name: 'document_type' | 'document_acceptance' | 'my_document_status'): Observable<CatalogOption[]> {
    return this.catalogs.options(name);
  }

  /** Una página de los documentos de la empresa (`admin_empresa` y `auditor`); los filtros vacíos no se mandan. */
  list(filters: DocumentFilters): Observable<Page<DocumentListItem>> {
    let params = new HttpParams().set('page', filters.page).set('page_size', filters.pageSize);
    const q = filters.q?.trim();
    if (q) params = params.set('q', q);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.hasCurrentVersion !== null && filters.hasCurrentVersion !== undefined) params = params.set('has_current_version', filters.hasCurrentVersion);
    return this.http.get<SuccessResponse<PageDto<DocumentListItem>>>(this.base, { params }).pipe(unwrapData(), map(toPage));
  }

  get(id: string): Observable<DocumentDetail> {
    return this.http.get<SuccessResponse<DocumentDetail>>(`${this.base}/${id}`).pipe(unwrapData());
  }

  /** Publica la versión vigente como aprobación importada (`201`); la anterior queda archivada y pide aceptar otra vez a todos los asignados. */
  publishVersion(id: string, dto: PublishVersionDto): Observable<DocumentVersion> {
    const body = new FormData();
    body.append('file', dto.file, dto.file.name);
    body.append('approved_at', dto.approved_at);
    // `multipart` no lleva objetos: los aprobadores viajan como una lista JSON en un solo campo.
    body.append('approvers', JSON.stringify(dto.approvers));
    const note = dto.note?.trim();
    if (note) body.append('note', note);
    return this.http.post<SuccessResponse<DocumentVersion>>(`${this.base}/${id}/versions`, body).pipe(unwrapData());
  }

  /** El enlace firmado de 5 minutos para ver (`inline`: PDF e imágenes) o bajar (`attachment`) el archivo de una versión. */
  fileLink(id: string, versionId: string, disposition: FileDisposition): Observable<DocumentFileLink> {
    const params = new HttpParams().set('disposition', disposition);
    return this.http.get<SuccessResponse<DocumentFileLink>>(`${this.base}/${id}/versions/${versionId}/file`, { params }).pipe(unwrapData());
  }

  /** Asigna la versión vigente a las personas (todo o nada); repetir a quien ya la tiene no cambia nada. Responde cuántas son nuevas. */
  assign(id: string, userIds: readonly string[]): Observable<number> {
    return this.http.post<SuccessResponse<{ added: number }>>(`${this.base}/${id}/assignments`, { user_ids: userIds }).pipe(unwrapData(), map((r) => r.added));
  }

  /** Lo que me asignaron, ya ordenado por el servidor (vencidos, por aceptar, aceptados). Recorre las páginas de 100 hasta tenerlo todo. */
  mine(): Observable<MyDocument[]> {
    const page = (n: number) =>
      this.http
        .get<SuccessResponse<PageDto<MyDocument>>>(this.mineUrl, { params: new HttpParams().set('page', n).set('page_size', MINE_PAGE_SIZE) })
        .pipe(unwrapData(), map(toPage));
    return page(1).pipe(
      expand((p) => (p.page.page < Math.min(p.page.totalPages, MINE_MAX_PAGES) ? page(p.page.page + 1) : EMPTY)),
      reduce<Page<MyDocument>, MyDocument[]>((all, p) => all.concat(p.items), []),
    );
  }

  /** Acepta la versión vigente que la persona vio (`version_id`): si cambió mientras leía, el servidor responde `409 DOCUMENT_VERSION_NOT_CURRENT`. */
  accept(id: string, versionId: string): Observable<DocumentAcceptanceReceipt> {
    return this.http.post<SuccessResponse<DocumentAcceptanceReceipt>>(`${this.base}/${id}/acceptance`, { version_id: versionId }).pipe(unwrapData());
  }
}
