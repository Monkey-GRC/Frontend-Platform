// Qué falló y cómo corregirlo (contracts/modules/compliance-audit.md, D90). Es lo que la última evaluación encontró en una prueba automática de un control (de nube o de servidores).
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export interface FindingResource {
  name: string | null;
  uid: string | null;
  region: string | null;
}

export interface FindingRemediation {
  /** Cómo corregirlo. Puede traer marcas de formato simples (negritas, viñetas): se muestra con `remediationBlocks`. */
  text: string;
  /** `es` si es la traducción de Monkey; `en` si se muestra el original por no tenerla. */
  language: 'es' | 'en';
  /** La traducción la hizo una IA y nadie la ha revisado: la pantalla lo dice. */
  is_ai_generated: boolean;
}

export interface Finding {
  id: string;
  title: string;
  /** Nulo cuando quien midió no califica sus checks (los servidores): no se muestra nivel, no se inventa. */
  severity: FindingSeverity | null;
  resources: FindingResource[];
  /** Cuántos recursos están afectados en total (`resources` trae hasta 50). */
  resources_total: number;
  remediation: FindingRemediation | null;
}

export interface FindingsPage {
  test_id: string;
  measured_at: string | null;
  items: Finding[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}