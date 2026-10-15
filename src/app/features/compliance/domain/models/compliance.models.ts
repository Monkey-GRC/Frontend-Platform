// Cumplimiento vive dentro de cada servicio: services/:id/cumplimiento/<pestaña> (P3, propuesta de MD-119).
export const COMPLIANCE_ROUTE = 'cumplimiento';

// Las pestañas del módulo, en el orden del recorrido GRC: controles, riesgos, causas, evidencias. Los textos son claves de traducción (vocabulario de D80).
export const COMPLIANCE_TABS = [
  { path: 'resumen', labelKey: 'COMPLIANCE.TABS.SUMMARY', icon: 'dashboard' },
  { path: 'controles', labelKey: 'COMPLIANCE.GLOSSARY.CONTROLS', icon: 'shield' },
  { path: 'riesgos', labelKey: 'COMPLIANCE.GLOSSARY.RISKS', icon: 'warning' },
  { path: 'causas', labelKey: 'COMPLIANCE.GLOSSARY.CAUSES', icon: 'troubleshoot' },
  { path: 'evidencias', labelKey: 'COMPLIANCE.GLOSSARY.EVIDENCE', icon: 'upload_file' },
] as const;

export type ComplianceTabPath = (typeof COMPLIANCE_TABS)[number]['path'];

// Qué roles reciben la vista técnica (D63, D64, SEG-54): el backend responde 403 a `?view=technical` para cualquier otro.
export const TECHNICAL_VIEW_ROLES: readonly string[] = ['auditor', 'consultor'];

// Lo mínimo de un servicio para llegar a su Cumplimiento desde el menú y para decir de cuál se habla: el cumplimiento se mide por servicio × marco
// (D62, D68) y cada servicio tiene su propia copia de controles, riesgos y causas (D28). `GET /services` solo manda el código del marco, no su nombre.
export interface ComplianceServiceRef {
  id: string;
  name: string;
  frameworks: { code: string; status: string }[];
}
