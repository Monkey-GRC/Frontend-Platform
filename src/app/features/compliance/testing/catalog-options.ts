import { of } from 'rxjs';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';

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
  risk_scale: ['1', '2', '3', '4', '5'].map((v) => option(v, v)),
};

/** Un `CatalogService` de prueba: responde las listas de arriba sin tocar la red. */
export const catalogServiceStub = () => ({ options: (name: string) => of(COMPLIANCE_OPTIONS[name] ?? []) });

export const provideCatalogStub = () => ({ provide: CatalogService, useValue: catalogServiceStub() });
