import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { RiskReadinessService } from '@features/compliance/domain/services/risk-readiness.service';

// D89 · No se declaran los activos de un servicio (conectar su nube, sus servidores…) hasta evaluar sus riesgos: la probabilidad y el impacto cambian de un servicio
// a otro. Quien llega a una pantalla de conexión con riesgos pendientes (por un enlace guardado) va al detalle del servicio, que abre el asistente para evaluarlos.
// Es una guía de la pantalla, no una barrera de seguridad: el Backend aún no lo exige (DT-77). Si no se puede saber (el servicio no responde), se deja pasar
// para no bloquear con un error que la pantalla de conexión mostrará mejor. Si el servicio acaba de comprobarse como listo (el detalle ya lo pidió), no se pregunta otra vez:
// el guard corre ANTES de navegar, así que una petición lenta aquí hace que el botón «Nueva conexión» parezca muerto.
export const risksEvaluatedGuard: CanActivateFn = (route) => {
  const serviceId = route.paramMap.get('id');
  const router = inject(Router);
  if (!serviceId) return true;
  return inject(RiskReadinessService)
    .progress(serviceId, { allowRecent: true })
    .pipe(
      map((progress) => (progress.ready ? true : router.createUrlTree(['/services', serviceId], { queryParams: { evaluar: 'riesgos' } }))),
      catchError(() => of(true)),
    );
};
