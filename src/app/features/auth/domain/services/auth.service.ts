import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '@environments/environment';
import { SessionService } from '@core/domain/services/session.service';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { LoginDto } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionService = inject(SessionService);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  login(dto: LoginDto): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/login`, dto).pipe(
      tap(() => this.sessionService.setAuthenticated())
    );
  }

  refresh(): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/refresh`, {});
  }

  logout(): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.baseUrl}/logout`).pipe(
      tap(() => this.sessionService.clear())
    );
  }

  validate(): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.baseUrl}/validate`).pipe(
      tap(() => this.sessionService.setAuthenticated())
    );
  }
}
