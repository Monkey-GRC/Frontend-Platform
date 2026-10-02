import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import {
  OrganizationalContext,
  OrganizationalContextInput,
} from '../models/organizational-context.models';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/onboarding/organizational-context`;

  /** Lo guardado, o el formulario vacío con la razón social si todavía no se declaró. */
  get(): Observable<OrganizationalContext> {
    return this.http.get<SuccessResponse<OrganizationalContext>>(this.url).pipe(map((r) => r.data!));
  }

  /** Crea la información la primera vez y la actualiza después (mismo endpoint). */
  save(input: OrganizationalContextInput): Observable<OrganizationalContext> {
    return this.http.put<SuccessResponse<OrganizationalContext>>(this.url, input).pipe(map((r) => r.data!));
  }
}
