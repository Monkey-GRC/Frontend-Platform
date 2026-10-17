import { of } from 'rxjs';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { RiskMatrixData } from '../domain/models/risk.models';
import { RiskService } from '../domain/services/risk.service';

// Las listas que el backend sirve en `GET /v1/catalogs/{nombre}` (compliance-catalogs.ts), tal como las devuelve: valor y etiqueta. Las pruebas de las pantallas las usan en
// lugar de pedirlas por HTTP; las listas reales las vigila el backend (`compliance-catalogs.spec.ts`).
const option = (value: string, label: string): CatalogOption => ({ value, label });

export const COMPLIANCE_OPTIONS: Record<string, CatalogOption[]> = {
  risk_treatment_decision: [option('mitigate', 'Mitigar'), option('accept', 'Aceptar'), option('transfer', 'Transferir'), option('avoid', 'Evitar')],
  responsible_type: [option('coo', 'COO'), option('it', 'TI'), option('compliance', 'Cumplimiento'), option('process', 'Proceso'), option('ciso', 'CISO'), option('asset_owner', 'Propietario del activo')],
  exclusion_status: [option('pending', 'Pendiente'), option('approved', 'Aprobada'), option('rejected', 'Rechazada')],
  trust_criterion: [option('security', 'Seguridad'), option('availability', 'Disponibilidad'), option('confidentiality', 'Confidencialidad')],
  dimension: [option('cloud', 'Nube'), option('policy', 'Documental'), option('server', 'Servidores')],
  risk_criterion: [option('confidentiality', 'Confidencialidad'), option('integrity', 'Integridad'), option('security', 'Seguridad')],
  failure_category: [option('human_resource', 'Recurso humano'), option('processes', 'Procesos')],
  loss_type: [option('reputational', 'Reputacional'), option('financial_loss', 'Pérdida financiera')],
  risk_level: [option('low', 'Bajo'), option('moderate', 'Moderado'), option('high', 'Alto'), option('critical', 'Crítico')],
  risk_scale: ['1', '2', '3', '4', '5'].map((v) => option(v, v)),
};

// La matriz 5×5 que sirve `GET /v1/risk-matrix` (el backend la vigila en `risk-types.spec.ts`): Bajo 1–4, Moderado 5–9, Alto 10–16, Crítico 17–25. Es dato de prueba, no lógica.
const levelOfValue = (v: number) => (v <= 4 ? 'low' : v <= 9 ? 'moderate' : v <= 16 ? 'high' : 'critical');
export const RISK_MATRIX: RiskMatrixData = {
  min: 1,
  max: 5,
  cells: [1, 2, 3, 4, 5].flatMap((likelihood) => [1, 2, 3, 4, 5].map((impact) => ({ likelihood, impact, value: likelihood * impact, level: levelOfValue(likelihood * impact) }))),
};

/** Lo que una pantalla con matriz necesita de `RiskService`: solo `matrix()`. Para las pruebas que no tienen su propio doble de `RiskService`. */
export const provideRiskMatrixStub = () => ({ provide: RiskService, useValue: { matrix: () => of(RISK_MATRIX) } });

/** Un `CatalogService` de prueba: responde las listas de arriba sin tocar la red. */
export const catalogServiceStub = () => ({ options: (name: string) => of(COMPLIANCE_OPTIONS[name] ?? []) });

export const provideCatalogStub = () => ({ provide: CatalogService, useValue: catalogServiceStub() });
