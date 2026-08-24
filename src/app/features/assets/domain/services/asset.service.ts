import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { Asset, AssetCompliance, CreateAssetDto } from '../models/asset.model';

@Injectable({ providedIn: 'root' })
export class AssetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/assets`;

  create(dto: CreateAssetDto): Observable<Asset> {
    return this.http.post<ApiResponse<Asset>>(this.baseUrl, dto).pipe(unwrapData());
  }

  getAll(): Observable<Asset[]> {
    return this.http.get<ApiResponse<Asset[]>>(this.baseUrl).pipe(unwrapData());
  }

  getCompliance(id: string): Observable<AssetCompliance> {
    return this.http
      .get<ApiResponse<AssetCompliance>>(`${this.baseUrl}/${id}/compliance`)
      .pipe(unwrapData());
  }

  delete(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.baseUrl}/${id}`);
  }
}
