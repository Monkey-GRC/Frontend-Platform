// contracts/modules/auth.md — POST /v1/auth/password/change. Se envía `code` (app) o `recovery_code`, no los dos.
export interface ChangePasswordInput {
  current_password: string;
  new_password: string;
  code?: string;
  recovery_code?: string;
}
