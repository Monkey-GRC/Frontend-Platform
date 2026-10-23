import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { RiskProgress, riskProgress } from '../utils/risk-progress';
import { RiskService } from './risk.service';

// ¿Ya evaluó la empresa los riesgos de este servicio? (D89). Pide los riesgos del servicio y aplica la regla de `riskProgress`.
@Injectable({ providedIn: 'root' })
export class RiskReadinessService {
  private readonly risks = inject(RiskService);

  progress(serviceId: string): Observable<RiskProgress> {
    return this.risks.listAllRisks(serviceId).pipe(map((list) => riskProgress(list)));
  }
}
