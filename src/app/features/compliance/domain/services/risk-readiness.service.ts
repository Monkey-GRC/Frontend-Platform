import { Injectable, inject } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';
import { RiskProgress, riskProgress } from '../utils/risk-progress';
import { RiskService } from './risk.service';

// Cuánto se confía en un «ya está evaluado» reciente (ms). Basta para el paso del detalle del servicio a «Nueva conexión» sin volver a pedir todos los riesgos.
const READY_TTL_MS = 60_000;

// ¿Ya evaluó la empresa los riesgos de este servicio? (D89). Pide los riesgos del servicio y aplica la regla de `riskProgress`.
@Injectable({ providedIn: 'root' })
export class RiskReadinessService {
  private readonly risks = inject(RiskService);
  // Solo se recuerda el «listo»: si faltan riesgos se vuelve a preguntar siempre, porque quien los acaba de evaluar no debe rebotar por un dato viejo.
  private readonly ready = new Map<string, { progress: RiskProgress; until: number }>();

  /** `allowRecent`: si hace menos de un minuto este servicio ya estaba listo, responde de inmediato en vez de pedir todos los riesgos otra vez. */
  progress(serviceId: string, options: { allowRecent?: boolean } = {}): Observable<RiskProgress> {
    const known = this.ready.get(serviceId);
    if (options.allowRecent && known && known.until > Date.now()) return of(known.progress);
    return this.risks.listAllRisks(serviceId).pipe(
      map((list) => riskProgress(list)),
      tap((progress) => (progress.ready ? this.ready.set(serviceId, { progress, until: Date.now() + READY_TTL_MS }) : this.ready.delete(serviceId))),
    );
  }
}
