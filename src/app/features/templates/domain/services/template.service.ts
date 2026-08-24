import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { CreateTemplateDto, MasterTemplate, Template, TemplateFullTree, UpdateTemplateDto } from '../models/template.models';

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/templates`;

  getMasterTemplates(): Observable<MasterTemplate[]> {
    return this.http
      .get<ApiResponse<MasterTemplate[]>>(`${this.baseUrl}/master`)
      .pipe(unwrapData());
  }

  adoptMasterTemplate(id: string): Observable<Template> {
    return this.http
      .post<ApiResponse<Template>>(`${this.baseUrl}/master/${id}/adopt`, {})
      .pipe(unwrapData());
  }

  create(dto: CreateTemplateDto): Observable<Template> {
    return this.http
      .post<ApiResponse<Template>>(this.baseUrl, dto)
      .pipe(unwrapData());
  }

  getAll(): Observable<Template[]> {
    return this.http
      .get<ApiResponse<Template[]>>(this.baseUrl)
      .pipe(unwrapData());
  }

  getById(id: string): Observable<Template> {
    return this.http
      .get<ApiResponse<Template>>(`${this.baseUrl}/${id}`)
      .pipe(unwrapData());
  }

  getFullTree(id: string): Observable<TemplateFullTree> {
    return this.http
      .get<ApiResponse<TemplateFullTree>>(`${this.baseUrl}/${id}/full-tree`)
      .pipe(unwrapData());
  }

  update(id: string, dto: UpdateTemplateDto): Observable<Template> {
    return this.http
      .patch<ApiResponse<Template>>(`${this.baseUrl}/${id}`, dto)
      .pipe(unwrapData());
  }

  delete(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.baseUrl}/${id}`);
  }
}
