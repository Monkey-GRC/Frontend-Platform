import { Asset } from '@shared/domain/models/technical-control.models';
import { canResumeConnection, resumeStep } from './connection-resume';

const asset = (platform: string, method: string, status: string, setup: Record<string, unknown> = {}): Asset =>
  ({ platform, provisioning: { connection_status: status, connection_method: method }, connection_setup: { method, steps: [], ...setup } }) as unknown as Asset;

describe('connection-resume', () => {
  it('sends a GCP connection without project number back to «Dar acceso», and with it to «Comprobar»', () => {
    expect(resumeStep(asset('gcp', 'identity_federation', 'pending', { project_number: null }))).toBe('access');
    expect(resumeStep(asset('gcp', 'identity_federation', 'pending', { project_number: '407295138461' }))).toBe('check');
  });

  it('sends an AWS role connection without role back to «Dar acceso», and with it to «Comprobar»; keys go to «Comprobar»', () => {
    expect(resumeStep(asset('aws', 'readonly_role', 'pending', { role_arn: null }))).toBe('access');
    expect(resumeStep(asset('aws', 'readonly_role', 'failed', { role_arn: 'arn:aws:iam::123456789012:role/R' }))).toBe('check');
    expect(resumeStep(asset('aws', 'access_keys', 'pending'))).toBe('check');
  });

  it('does not resume a checked connection, a channel that is not a cloud wizard (the agent), or one without a channel', () => {
    expect(canResumeConnection(asset('aws', 'readonly_role', 'validated'))).toBeFalse();
    expect(canResumeConnection(asset('aws', 'readonly_role', 'active'))).toBeFalse();
    expect(canResumeConnection(asset('linux', 'agent', 'pending'))).toBeFalse();
    expect(canResumeConnection({ provisioning: { connection_status: 'pending' } } as unknown as Asset)).toBeFalse();
  });
});
