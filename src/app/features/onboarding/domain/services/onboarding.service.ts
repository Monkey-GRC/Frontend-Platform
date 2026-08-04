import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import {
  CompanyProfile,
  CompleteOnboardingDto,
  CompleteOnboardingResult,
  OnboardingMasterTemplate,
  UpsertCompanyProfileDto,
} from '../models/onboarding.models';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/onboarding`;

  getMasterTemplates(onboardingCode: string): Observable<OnboardingMasterTemplate[]> {
    const params = new HttpParams().set('onboarding_code', onboardingCode);
    return this.http
      .get<ApiResponse<OnboardingMasterTemplate[]>>(`${this.baseUrl}/master-templates`, { params })
      .pipe(unwrapData());
  }

  complete(dto: CompleteOnboardingDto): Observable<CompleteOnboardingResult> {
    return this.http
      .post<ApiResponse<CompleteOnboardingResult>>(`${this.baseUrl}/complete`, dto)
      .pipe(unwrapData());
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
