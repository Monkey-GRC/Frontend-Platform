// Cumplimiento vive dentro de cada servicio: services/:id/cumplimiento/<pestaña> (P3, propuesta de MD-119).
export const COMPLIANCE_ROUTE = 'cumplimiento';

// Las pestañas del módulo, en el orden del recorrido GRC: un riesgo se origina en causas, las causas se mitigan con controles y los controles se
// demuestran con evidencias. Los textos son claves de traducción (vocabulario de D80).
export const COMPLIANCE_TABS = [
  { path: 'resumen', labelKey: 'COMPLIANCE.TABS.SUMMARY', icon: 'dashboard' },
  { path: 'riesgos', labelKey: 'COMPLIANCE.GLOSSARY.RISKS', icon: 'warning' },
  { path: 'causas', labelKey: 'COMPLIANCE.GLOSSARY.CAUSES', icon: 'troubleshoot' },
  { path: 'controles', labelKey: 'COMPLIANCE.GLOSSARY.CONTROLS', icon: 'shield' },
  { path: 'evidencias', labelKey: 'COMPLIANCE.GLOSSARY.EVIDENCE', icon: 'upload_file' },
] as const;

// La pestaña por la que se entra mientras el Resumen (MD-140) no exista: la primera del recorrido que ya es real.
export const DEFAULT_COMPLIANCE_TAB: ComplianceTabPath = 'riesgos';

export type ComplianceTabPath = (typeof COMPLIANCE_TABS)[number]['path'];

// Qué roles reciben la vista técnica: auditor y consultor (D63, D64, SEG-54) y, mientras no se definan los permisos por pantalla (P3), también el
// administrador de la empresa, que es quien conoce el cumplimiento y necesita ver todo lo que cada control pide (pruebas incluidas). Debe coincidir con
// `TECHNICAL_ROLES` del backend (`view-access.ts`), que responde 403 a `?view=technical` para cualquier otro rol.
export const TECHNICAL_VIEW_ROLES: readonly string[] = ['auditor', 'consultor', 'admin_empresa'];

// Lo mínimo de un servicio para llegar a su Cumplimiento desde el menú y para decir de cuál se habla: el cumplimiento se mide por servicio × marco
// (D62, D68) y cada servicio tiene su propia copia de controles, riesgos y causas (D28). `GET /services` solo manda el código del marco, no su nombre.
export interface ComplianceServiceRef {
  id: string;
  name: string;
  frameworks: { code: string; status: string }[];
}
