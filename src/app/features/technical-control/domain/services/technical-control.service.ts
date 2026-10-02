import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import {
  Asset,
  AssetPage,
  NewAssetInput,
  Scope,
  ScopeCounts,
  TechnicalControlState,
  ValidationResult,
} from '../models/technical-control.models';

// El Componente 3 (control técnico): escenario y scope de un servicio, y los sistemas que el
// cliente conecta. Las credenciales solo viajan al registrar un sistema; la API no las devuelve.
@Injectable({ providedIn: 'root' })
export class TechnicalControlService {
  private readonly http = inject(HttpClient);
  private readonly services = `${environment.apiUrl}/services`;
  private readonly assets = `${environment.apiUrl}/assets`;

  state(serviceId: string): Observable<TechnicalControlState> {
    return this.http
      .get<SuccessResponse<TechnicalControlState>>(`${this.services}/${serviceId}/technical-control`)
      .pipe(map((r) => r.data!));
  }

  setScenario(serviceId: string, scenario: string): Observable<void> {
    return this.http
      .put<SuccessResponse>(`${this.services}/${serviceId}/deployment-scenario`, { deployment_scenario: scenario })
      .pipe(map(() => undefined));
  }

  setScope(serviceId: string, counts: ScopeCounts): Observable<Scope> {
    return this.http.put<SuccessResponse<Scope>>(`${this.services}/${serviceId}/scope`, counts).pipe(map((r) => r.data!));
  }

  listAssets(serviceId: string): Observable<AssetPage> {
    const params = new HttpParams().set('service_id', serviceId).set('page_size', 100);
    return this.http.get<SuccessResponse<AssetPage>>(this.assets, { params }).pipe(map((r) => r.data!));
  }

  createAsset(input: NewAssetInput): Observable<Asset> {
    return this.http.post<SuccessResponse<Asset>>(this.assets, input).pipe(map((r) => r.data!));
  }

  validate(assetId: string): Observable<ValidationResult> {
    return this.http.post<SuccessResponse<ValidationResult>>(`${this.assets}/${assetId}/validate`, {}).pipe(map((r) => r.data!));
  }

  activate(assetId: string): Observable<Asset> {
    return this.http.post<SuccessResponse<Asset>>(`${this.assets}/${assetId}/activate`, {}).pipe(map((r) => r.data!));
  }

  schedule(assetId: string, frequency: string): Observable<Asset> {
    return this.http.put<SuccessResponse<Asset>>(`${this.assets}/${assetId}/schedule`, { frequency }).pipe(map((r) => r.data!));
  }

  getAsset(assetId: string): Observable<Asset> {
    return this.http.get<SuccessResponse<Asset>>(`${this.assets}/${assetId}`).pipe(map((r) => r.data!));
  }
}
