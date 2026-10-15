// Cumplimiento vive dentro de cada servicio: services/:id/cumplimiento/<pestaña> (P3, propuesta de MD-119).
export const COMPLIANCE_ROUTE = 'cumplimiento';

// Las pestañas del módulo. Los textos son claves de traducción; los de las secciones salen del glosario (MD-109).
export const COMPLIANCE_TABS = [
  { path: 'resumen', labelKey: 'COMPLIANCE.TABS.SUMMARY', icon: 'dashboard' },
  { path: 'acciones', labelKey: 'COMPLIANCE.GLOSSARY.CONTROLS', icon: 'shield' },
  { path: 'riesgos', labelKey: 'COMPLIANCE.GLOSSARY.RISKS', icon: 'warning' },
  { path: 'evidencias', labelKey: 'COMPLIANCE.GLOSSARY.EVIDENCE', icon: 'upload_file' },
] as const;

export type ComplianceTabPath = (typeof COMPLIANCE_TABS)[number]['path'];

// Qué roles reciben la vista técnica (D63, D64, SEG-54): el backend responde 403 a `?view=technical` para cualquier otro.
export const TECHNICAL_VIEW_ROLES: readonly string[] = ['auditor', 'consultor'];

// Lo mínimo de un servicio para llegar a su Cumplimiento desde el menú.
export interface ComplianceServiceRef {
  id: string;
  name: string;
}
