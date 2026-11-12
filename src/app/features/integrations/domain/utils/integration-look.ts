import { StatusTone } from '@shared/domain/models/status-tone.model';
import { Integration, IntegrationConnection, IntegrationPermissionAccess, IntegrationSecurityTopic, IntegrationStatus } from '../models/integration.models';

const TONES: Record<IntegrationStatus, StatusTone> = { active: 'ok', pending: 'neutral', needs_attention: 'warn' };

export function integrationTone(status: IntegrationStatus): StatusTone {
  return TONES[status] ?? 'neutral';
}

/** Las conexiones con problema de conexión (no de cumplimiento, D57) de las integraciones que lo tienen. */
export function attentionItems(items: Integration[]): { integration: Integration; connections: IntegrationConnection[] }[] {
  return items
    .filter((i) => i.status === 'needs_attention')
    .map((integration) => ({ integration, connections: integration.connections.filter((c) => c.needs_attention) }));
}

/** El enlace a la conexión: por el primer servicio al que pertenece. */
export function connectionLink(connection: IntegrationConnection, serviceId?: string): string[] | null {
  const id = serviceId ?? connection.services[0]?.id;
  return id ? ['/services', id, 'connections', connection.asset_id] : null;
}

const CONNECTION_TONES: Record<string, StatusTone> = { active: 'ok', scheduled: 'ok', pending: 'neutral', validated: 'neutral', failed: 'bad' };

/** El tono del estado de una conexión (`provisioning_status`). */
export function connectionTone(status: string): StatusTone {
  return CONNECTION_TONES[status] ?? 'neutral';
}

const SECURITY_ICONS: Record<IntegrationSecurityTopic, string> = {
  read_only: 'lock',
  temporary_credentials: 'schedule',
  external_id: 'key',
  isolated_execution: 'deployed_code',
  tenant_isolation: 'apartment',
  encrypted_keys: 'shield',
};

/** El icono (Material Symbols) de un tema de seguridad; uno nuevo del backend cae en el escudo. */
export function securityIcon(topic: string): string {
  return SECURITY_ICONS[topic as IntegrationSecurityTopic] ?? 'shield';
}

/** El tono de la insignia de acceso de un permiso: lectura es ok; escritura, aviso. */
export function accessTone(access: IntegrationPermissionAccess): StatusTone {
  return access === 'read' ? 'ok' : 'warn';
}
