import { of } from 'rxjs';
import { ConnectionOption, ConnectionOptionName } from '@shared/domain/models/catalog.models';

// Lo que sirve `GET /v1/catalogs/{gcp_connection_scope|gcp_setup_method|connection_method}` (D114), con la forma exacta del contrato: `value`, `label`, `description`, `availability` y `tags`. Dato de prueba, no lógica.
export const GCP_CONNECTION_SCOPE: ConnectionOption[] = [
  { value: 'project', label: 'Un proyecto', description: 'Monkey revisa la configuración de un proyecto de Google Cloud.', availability: 'available', tags: [] },
  { value: 'organization', label: 'Una organización', description: 'Monkey revisa todos los proyectos de tu organización.', availability: 'coming_soon', tags: [] },
];

export const GCP_SETUP_METHOD: ConnectionOption[] = [
  { value: 'cloud_shell', label: 'Con Cloud Shell', description: 'Pegas un comando en la consola de Google Cloud.', availability: 'available', tags: ['recommended', 'fastest'] },
  { value: 'terraform', label: 'Con Terraform', description: 'Aplicas una configuración desde tu código de infraestructura.', availability: 'coming_soon', tags: ['advanced'] },
];

export const CONNECTION_METHOD: ConnectionOption[] = [
  { value: 'readonly_role', label: 'Con un rol de solo lectura', description: 'Creas en tu cuenta un rol que solo puede leer.', availability: 'available', tags: ['recommended'] },
  { value: 'access_keys', label: 'Con llaves de acceso', description: 'Pegas una llave de acceso de solo lectura.', availability: 'available', tags: ['less_secure'] },
  { value: 'identity_federation', label: 'Con federación de identidad', description: 'Sin llaves.', availability: 'available', tags: ['recommended'] },
  { value: 'agent', label: 'Con un agente', description: 'Instalas un agente.', availability: 'available', tags: [] },
];

export const CONNECTION_OPTIONS: Record<ConnectionOptionName, ConnectionOption[]> = {
  gcp_connection_scope: GCP_CONNECTION_SCOPE,
  gcp_setup_method: GCP_SETUP_METHOD,
  connection_method: CONNECTION_METHOD,
};

/** `CatalogService.connectionOptions` de prueba: responde las listas de arriba sin tocar la red. */
export const connectionOptionsStub = (name: ConnectionOptionName) => of(CONNECTION_OPTIONS[name]);
