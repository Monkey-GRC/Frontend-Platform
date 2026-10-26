import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, last, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import {
  Asset,
  AssetPage,
  DiscoveredAssetsPage,
  Execution,
  ExecutionPage,
  NewAssetInput,
  UpdateAssetInput,
  TechnicalControlState,
  ValidationResult,
} from '../models/technical-control.models';

// El Componente 3 (control técnico): las conexiones (activos) que el cliente registra en un servicio. Las credenciales solo viajan al registrar una conexión; la API no las devuelve.
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

  listAssets(serviceId: string): Observable<AssetPage> {
    const params = new HttpParams().set('service_id', serviceId).set('page_size', 100);
    return this.http.get<SuccessResponse<AssetPage>>(this.assets, { params }).pipe(map((r) => r.data!));
  }

  createAsset(input: NewAssetInput): Observable<Asset> {
    return this.http.post<SuccessResponse<Asset>>(this.assets, input).pipe(map((r) => r.data!));
  }

  // Los activos que la conexión reconoció en la cuenta, en las regiones declaradas, con cuáles son del servicio. Trae todas las páginas (máx. 500).
  listDiscovered(assetId: string, serviceId: string): Observable<DiscoveredAssetsPage> {
    const page = (n: number) =>
      this.http
        .get<SuccessResponse<DiscoveredAssetsPage>>(`${this.assets}/${assetId}/resources`, { params: new HttpParams().set('page', n).set('page_size', 100).set('service_id', serviceId) })
        .pipe(map((r) => r.data!));
    return page(1).pipe(
      expand((p) => (p.page < p.total_pages ? page(p.page + 1).pipe(map((next) => ({ ...next, items: [...p.items, ...next.items] }))) : EMPTY)),
      last(),
    );
  }

  // Fija EXACTAMENTE qué activos de la conexión son de este servicio; los demás quedan fuera.
  setServiceAssets(serviceId: string, connectionId: string, assetIds: string[]): Observable<{ included: number; added: number; removed: number }> {
    return this.http
      .put<SuccessResponse<{ included: number; added: number; removed: number }>>(`${this.services}/${serviceId}/connections/${connectionId}/assets`, { asset_ids: assetIds })
      .pipe(map((r) => r.data!));
  }

  updateAsset(assetId: string, input: UpdateAssetInput): Observable<Asset> {
    return this.http.patch<SuccessResponse<Asset>>(`${this.assets}/${assetId}`, input).pipe(map((r) => r.data!));
  }

  // Dar de baja: el sistema deja de evaluarse y de listarse; su historial se conserva.
  removeAsset(assetId: string): Observable<void> {
    return this.http.delete<SuccessResponse<null>>(`${this.assets}/${assetId}`).pipe(map(() => undefined));
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

  // El cliente entrega el rol de solo lectura que creó en su cuenta. La conexión vuelve a «pendiente»: hay que comprobarla de nuevo.
  setRoleArn(assetId: string, roleArn: string): Observable<Asset> {
    return this.http.patch<SuccessResponse<Asset>>(`${this.assets}/${assetId}/connection`, { role_arn: roleArn }).pipe(map((r) => r.data!));
  }

  // La plantilla que el cliente crea en su cuenta (rol de solo lectura). Se descarga como archivo.
  downloadRoleTemplate(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/connection-templates/aws-readonly-role`, { responseType: 'blob' });
  }

  // «Evaluar ahora»: deja una evaluación en cola y responde ya; el avance se consulta con `lastExecution`.
  evaluate(assetId: string): Observable<Execution> {
    return this.http.post<SuccessResponse<Execution>>(`${this.assets}/${assetId}/executions`, {}).pipe(map((r) => r.data!));
  }

  lastExecution(assetId: string): Observable<Execution | null> {
    const params = new HttpParams().set('page_size', 1);
    return this.http
      .get<SuccessResponse<ExecutionPage>>(`${this.assets}/${assetId}/executions`, { params })
      .pipe(map((r) => r.data!.items[0] ?? null));
  }
}
