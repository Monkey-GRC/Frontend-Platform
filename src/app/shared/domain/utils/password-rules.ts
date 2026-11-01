import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// SEG-13: 12+ caracteres con mayúscula, minúscula, número y símbolo. Se valida aquí para avisar antes de enviar; el backend la vuelve a exigir.
export const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

/** Valida a nivel de grupo que la contraseña y su confirmación coincidan. Marca el error `passwordMismatch` en el grupo. */
export const passwordsMatch =
  (passwordName = 'password', confirmName = 'password_confirmation'): ValidatorFn =>
  (group: AbstractControl): ValidationErrors | null =>
    group.get(passwordName)?.value === group.get(confirmName)?.value ? null : { passwordMismatch: true };

// ── La guía de la contraseña nueva ───────────────────────────────────────────────────────────────────────────────────────────────────
// Lo que la persona ve mientras escribe: cada requisito de SEG-13, que no sea la actual (el backend además la compara con las 5 anteriores) y que las dos copias coincidan.
// `ok`: cumple. `idle`: todavía no se puede juzgar (el campo está vacío). `bad`: solo para «coinciden» cuando ya escribió la confirmación y no es igual.
export type CheckState = 'idle' | 'ok' | 'bad';

export type PasswordCheckKey = 'min_length' | 'lowercase' | 'uppercase' | 'number' | 'symbol' | 'different' | 'match';

export interface PasswordCheck {
  key: PasswordCheckKey;
  state: CheckState;
}

export const PASSWORD_MIN_LENGTH = 12;

export function passwordChecks(password: string, confirmation: string, current: string | null = null): PasswordCheck[] {
  const typed = password.length > 0;
  const verdict = (met: boolean): CheckState => (met ? 'ok' : 'idle');
  const checks: PasswordCheck[] = [
    { key: 'min_length', state: verdict(Array.from(password).length >= PASSWORD_MIN_LENGTH) },
    { key: 'lowercase', state: verdict(/[a-z]/.test(password)) },
    { key: 'uppercase', state: verdict(/[A-Z]/.test(password)) },
    { key: 'number', state: verdict(/\d/.test(password)) },
    { key: 'symbol', state: verdict(/[^A-Za-z0-9]/.test(password)) },
  ];
  // `current === null` es una pantalla que no tiene contraseña actual (recuperar con el enlace): no hay con qué compararla.
  if (current !== null) checks.push({ key: 'different', state: typed && current.length > 0 && password !== current ? 'ok' : 'idle' });
  checks.push({ key: 'match', state: !confirmation ? 'idle' : confirmation === password && typed ? 'ok' : 'bad' });
  return checks;
}

/** Valida a nivel de grupo que la contraseña nueva no sea la actual. Marca el error `sameAsCurrent` en el grupo. */
export const differentFromCurrent =
  (currentName = 'current_password', passwordName = 'password'): ValidatorFn =>
  (group: AbstractControl): ValidationErrors | null => {
    const current = group.get(currentName)?.value as string | undefined;
    const next = group.get(passwordName)?.value as string | undefined;
    return current && next && current === next ? { sameAsCurrent: true } : null;
  };
