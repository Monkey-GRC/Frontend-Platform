import { Integration, IntegrationConnection } from '../models/integration.models';
import { attentionItems, connectionLink, connectionTone, integrationTone, securityIcon, accessTone } from './integration-look';

const conn = (over: Partial<IntegrationConnection> = {}): IntegrationConnection => ({
  asset_id: 'a1', code: 'AST-0001', name: 'Prod', connection_status: 'active', operational_status: 'operational', needs_attention: false,
  services: [{ id: 's1', name: 'Pagos' }, { id: 's2', name: 'Soporte' }], ...over,
});

describe('integration-look', () => {
  it('maps the status to a tone', () => {
    expect(integrationTone('active')).toBe('ok');
    expect(integrationTone('pending')).toBe('neutral');
    expect(integrationTone('needs_attention')).toBe('warn');
  });

  it('lists only the connections that need attention, of the integrations that need it', () => {
    const items = [
      { code: 'aws', status: 'needs_attention', connections: [conn({ needs_attention: true }), conn({ asset_id: 'a2' })] },
      { code: 'jira', status: 'active', connections: [conn()] },
    ] as Integration[];
    const out = attentionItems(items);
    expect(out.length).toBe(1);
    expect(out[0].connections.map((c) => c.asset_id)).toEqual(['a1']);
  });

  it('links a connection through its first service, or a given one', () => {
    expect(connectionLink(conn())).toEqual(['/services', 's1', 'connections', 'a1']);
    expect(connectionLink(conn(), 's2')).toEqual(['/services', 's2', 'connections', 'a1']);
    expect(connectionLink(conn({ services: [] }))).toBeNull();
  });

  it('maps the connection status to a tone', () => {
    expect(connectionTone('active')).toBe('ok');
    expect(connectionTone('scheduled')).toBe('ok');
    expect(connectionTone('pending')).toBe('neutral');
    expect(connectionTone('validated')).toBe('neutral');
    expect(connectionTone('failed')).toBe('bad');
  });

  it('picks an icon per security topic and falls back to the shield', () => {
    expect(securityIcon('read_only')).toBe('lock');
    expect(securityIcon('temporary_credentials')).toBe('schedule');
    expect(securityIcon('external_id')).toBe('key');
    expect(securityIcon('isolated_execution')).toBe('deployed_code');
    expect(securityIcon('tenant_isolation')).toBe('apartment');
    expect(securityIcon('encrypted_keys')).toBe('shield');
    expect(securityIcon('new_topic')).toBe('shield');
  });

  it('gives read access the ok tone and write the warn tone', () => {
    expect(accessTone('read')).toBe('ok');
    expect(accessTone('write')).toBe('warn');
  });
});
