// contracts/modules/auth.md — POST /v1/auth/password/change. Se envía `code` (app) o `recovery_code`, no los dos.
export interface ChangePasswordInput {
  current_password: string;
  new_password: string;
  code?: string;
  recovery_code?: string;
}

// contracts/autenticacion.md — GET /v1/auth/devices (D123, SEG-84). `browser`, `os`, `device_type`, `country` y `city` pueden venir null (`device_type` puede faltar en una versión anterior del backend).
export type DeviceType = 'computer' | 'mobile' | 'tablet';

export interface RememberedDevice {
  id: string;
  browser: string | null;
  os: string | null;
  device_type?: DeviceType | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  is_current: boolean;
}
