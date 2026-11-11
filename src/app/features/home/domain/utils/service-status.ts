import { DashboardFramework } from '../models/dashboard.models';

export type ServiceReadiness = 'needs_work' | 'almost_ready' | 'ready' | 'not_measured';

// El estado general de un servicio es el peor de sus marcos (no hay una nota por servicio en el backend: se deriva de lo que ya llega). Orden, de peor a mejor:
// «Requiere trabajo» (también un marco medido que el motor da por no conforme), «Casi listo», «Sin medir» y «Preparado». Lo pendiente no cuenta como cumplido:
// si algún marco no tiene resultados, el servicio no puede decir «Preparado». Un servicio sin marcos no tiene nada medido.
export function serviceReadiness(frameworks: DashboardFramework[]): ServiceReadiness {
  if (frameworks.some((f) => f.readiness === 'needs_work' || (f.readiness !== 'not_measured' && f.verdict === 'non_compliant'))) return 'needs_work';
  if (frameworks.some((f) => f.readiness === 'almost_ready')) return 'almost_ready';
  if (frameworks.length === 0 || frameworks.some((f) => f.readiness !== 'ready')) return 'not_measured';
  return 'ready';
}
