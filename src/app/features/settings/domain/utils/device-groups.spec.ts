import { RememberedDevice } from '../models/security.models';
import { deviceTypeOf, groupDevices } from './device-groups';

const d = (over: Partial<RememberedDevice>): RememberedDevice => ({
  id: 'x', browser: 'Chrome', os: 'Ubuntu', device_type: 'computer', ip_address: null, country: null, city: null,
  created_at: '2026-11-01T10:00:00Z', expires_at: '2026-12-01T10:00:00Z', last_used_at: null, is_current: false, ...over,
});

describe('device groups', () => {
  it('derives the type from the system when the backend does not send it', () => {
    expect(deviceTypeOf({ device_type: undefined, os: 'Android' })).toBe('mobile');
    expect(deviceTypeOf({ device_type: undefined, os: 'macOS' })).toBe('computer');
    expect(deviceTypeOf({ device_type: undefined, os: null })).toBeNull();
    expect(deviceTypeOf({ device_type: 'tablet', os: 'iOS' })).toBe('tablet');
  });

  it('groups by type and system, current group first, then the most recent', () => {
    const groups = groupDevices([
      d({ id: 'a', os: 'Android', device_type: 'mobile', last_used_at: '2026-11-17T10:00:00Z' }),
      d({ id: 'b', os: 'Windows', last_used_at: '2026-11-10T10:00:00Z' }),
      d({ id: 'c', os: 'Windows', last_used_at: '2026-11-12T10:00:00Z' }),
      d({ id: 'e', os: 'Ubuntu', is_current: true }),
      d({ id: 'f', os: 'Ubuntu' }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['computer|Ubuntu', 'mobile|Android', 'computer|Windows']);
    expect(groups[0].devices.map((x) => x.id)).toEqual(['e', 'f']);
    expect(groups[2].devices.map((x) => x.id)).toEqual(['c', 'b']);
    expect(groups[0].hasCurrent).toBeTrue();
  });

  it('keeps a group for devices with no known system', () => {
    const groups = groupDevices([d({ id: 'a', os: null, device_type: null })]);
    expect(groups.length).toBe(1);
    expect(groups[0].type).toBeNull();
  });
});
