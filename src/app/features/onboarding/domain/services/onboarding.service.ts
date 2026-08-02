import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { CompanyProfile, CreateOnboardingAdminDto, UpsertCompanyProfileDto } from '../models/onboarding.models';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/onboarding`;

  createAdmin(dto: CreateOnboardingAdminDto): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/admin`, dto);
  }

  getCompanyProfile(): Observable<CompanyProfile> {
    return this.http
      .get<ApiResponse<CompanyProfile>>(`${this.baseUrl}/company-profile`)
      .pipe(unwrapData());
  }

  updateCompanyProfile(dto: UpsertCompanyProfileDto): Observable<CompanyProfile> {
    return this.http
      .patch<ApiResponse<CompanyProfile>>(`${this.baseUrl}/company-profile`, dto)
      .pipe(unwrapData());
  }
}
