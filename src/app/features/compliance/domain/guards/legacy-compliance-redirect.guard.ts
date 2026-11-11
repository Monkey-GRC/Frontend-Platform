import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { COMPLIANCE_ROUTE, COMPLIANCE_SECTIONS, DEFAULT_COMPLIANCE_SECTION } from '../models/compliance.models';
import { ActiveComplianceService } from '../services/active-compliance.service';

// Las rutas viejas `/services/:id/cumplimiento[/<pestaña>]` ya no son una pantalla: llevan a `/cumplimiento/<sección>` y dejan ese servicio como activo.
// «acciones» se llamaba así antes de ser «controles»; una pestaña desconocida cae en el Resumen. Los parámetros de la consulta (`abrir`) se conservan.
const RENAMED: Readonly<Record<string, string>> = { acciones: 'controles' };

export const legacyComplianceRedirectGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const id = route.paramMap.get('id');
  const tab = route.paramMap.get('tab') ?? '';
  const section = RENAMED[tab] ?? COMPLIANCE_SECTIONS.find((s) => s.path === tab)?.path ?? DEFAULT_COMPLIANCE_SECTION;
  if (id) inject(ActiveComplianceService).set(id);
  return inject(Router).createUrlTree(['/', COMPLIANCE_ROUTE, section], { queryParams: route.queryParams });
};
