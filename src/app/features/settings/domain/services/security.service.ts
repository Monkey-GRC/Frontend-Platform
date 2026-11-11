import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { SuccessResponse } from '@shared/domain/models/api-response.model';
import { unwrapData } from '@shared/domain/utils/unwrap-response';
import { ChangePasswordInput } from '../models/security.models';

// La seguridad de la propia cuenta (contracts/modules/auth.md): cambiar la contraseña (D101) y renovar los códigos de recuperación (D94).
@Injectable({ providedIn: 'root' })
export class SecurityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  /** Pide la contraseña actual y un código vigente del segundo factor. Cierra las demás sesiones; esta sigue. */
  changePassword(input: ChangePasswordInput): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/password/change`, input).pipe(map(() => void 0));
  }

  /** «Olvidé mi contraseña» con la sesión abierta: pide el enlace para el correo de la propia persona. Responde igual exista o no la cuenta (D101). */
  requestPasswordRecovery(email: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/password/forgot`, { email }).pipe(map(() => void 0));
  }

  /** Genera 10 códigos nuevos; los anteriores dejan de servir. Se muestran una sola vez. */
  regenerateRecoveryCodes(code: string): Observable<string[]> {
    return this.http
      .post<SuccessResponse<{ recovery_codes: string[] }>>(`${this.baseUrl}/mfa/recovery-codes`, { code })
      .pipe(unwrapData(), map((d) => d.recovery_codes));
  }
}
