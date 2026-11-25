
// Cumplimiento es un grupo del menú: cada sección es una página en `/cumplimiento/<sección>` (sin id). El servicio activo no va en la ruta: se elige en el
// encabezado y se recuerda entre secciones (`ActiveComplianceService`). Un enlace que lleva a un servicio concreto lo manda en `?servicio=<id>`.
export const COMPLIANCE_ROUTE = 'cumplimiento';
export const COMPLIANCE_SERVICE_PARAM = 'servicio';
// Un enlace que lleva a definir el período auditado de un marco lo manda en `?definir=<código del marco>` (paso «Medir un marco» del onboarding, Inicio).
export const DEFINE_PERIOD_PARAM = 'definir';

// Las secciones del módulo, en el orden del recorrido GRC: un riesgo se origina en causas, las causas se mitigan con controles y los controles se
// demuestran con evidencias. Los textos son claves de traducción (vocabulario de D80). El menú (`navigation.config.ts`) usa las mismas rutas y claves.
export const COMPLIANCE_SECTIONS = [
  { path: 'resumen', labelKey: 'COMPLIANCE.SECTIONS.SUMMARY' },
  { path: 'riesgos', labelKey: 'COMPLIANCE.GLOSSARY.RISKS' },
  { path: 'causas', labelKey: 'COMPLIANCE.GLOSSARY.CAUSES' },
  { path: 'controles', labelKey: 'COMPLIANCE.GLOSSARY.CONTROLS' },
  { path: 'evidencias', labelKey: 'COMPLIANCE.GLOSSARY.EVIDENCE' },
  { path: 'exclusiones', labelKey: 'COMPLIANCE.SECTIONS.EXCLUSIONS' },
] as const;

// La sección por la que se entra: el Resumen (MD-140), el estado del servicio antes que el detalle.
export const DEFAULT_COMPLIANCE_SECTION: ComplianceSectionPath = 'resumen';

export type ComplianceSectionPath = (typeof COMPLIANCE_SECTIONS)[number]['path'];

// Lo mínimo de un servicio para llegar a su Cumplimiento desde el menú y para decir de cuál se habla: el cumplimiento se mide por servicio × marco
// (D62, D68) y cada servicio tiene su propia copia de controles, riesgos y causas (D28). `GET /services` solo manda el código del marco, no su nombre.
export interface ComplianceServiceRef {
  id: string;
  name: string;
  frameworks: { code: string; status: string }[];
}
