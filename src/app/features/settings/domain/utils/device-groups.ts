import { DeviceType, RememberedDevice } from '../models/security.models';

export interface DeviceGroup {
  key: string;
  type: DeviceType | null;
  os: string | null;
  devices: RememberedDevice[];
  hasCurrent: boolean;
}

/** The kind of device: the one the backend sent, or, if it is missing, the one the operating system implies (`null` when it says nothing). */
export function deviceTypeOf(device: Pick<RememberedDevice, 'device_type' | 'os'>): DeviceType | null {
  if (device.device_type) return device.device_type;
  switch ((device.os ?? '').toLowerCase()) {
    case 'windows':
    case 'macos':
    case 'linux':
    case 'ubuntu':
    case 'chromeos':
      return 'computer';
    case 'android':
    case 'ios':
      return 'mobile';
    default:
      return null;
  }
}

const lastSeen = (device: RememberedDevice): number => Date.parse(device.last_used_at ?? device.created_at) || 0;

/** One group per device type + operating system. The group with the current device goes first, then the most recently used; inside, the same order. */
export function groupDevices(devices: RememberedDevice[]): DeviceGroup[] {
  const groups = new Map<string, DeviceGroup>();
  for (const device of devices) {
    const type = deviceTypeOf(device);
    const os = device.os ?? null;
    const key = `${type ?? ''}|${os ?? ''}`;
    const group = groups.get(key) ?? { key, type, os, devices: [], hasCurrent: false };
    group.devices.push(device);
    group.hasCurrent ||= device.is_current;
    groups.set(key, group);
  }
  const newest = (group: DeviceGroup) => Math.max(...group.devices.map(lastSeen));
  const order = (a: RememberedDevice, b: RememberedDevice) => Number(b.is_current) - Number(a.is_current) || lastSeen(b) - lastSeen(a);
  for (const group of groups.values()) group.devices.sort(order);
  return [...groups.values()].sort((a, b) => Number(b.hasCurrent) - Number(a.hasCurrent) || newest(b) - newest(a));
}
