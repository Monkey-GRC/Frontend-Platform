import { FormControl, FormGroup } from '@angular/forms';
import { differentFromCurrent, passwordChecks, passwordsMatch, STRONG_PASSWORD } from './password-rules';

const states = (password: string, confirmation = '', current: string | null = null) => Object.fromEntries(passwordChecks(password, confirmation, current).map((c) => [c.key, c.state]));

describe('passwordChecks (la guía de la contraseña nueva)', () => {
  it('shows every requirement as pending while nothing is typed', () => {
    expect(states('')).toEqual({ min_length: 'idle', lowercase: 'idle', uppercase: 'idle', number: 'idle', symbol: 'idle', match: 'idle' });
  });

  it('marks each requirement as it is met', () => {
    expect(states('hola')).toEqual(jasmine.objectContaining({ lowercase: 'ok', uppercase: 'idle', number: 'idle', symbol: 'idle', min_length: 'idle' }));
    expect(states('Hola1!')).toEqual(jasmine.objectContaining({ lowercase: 'ok', uppercase: 'ok', number: 'ok', symbol: 'ok', min_length: 'idle' }));
    expect(states('UnaClaveLarga123!')).toEqual(jasmine.objectContaining({ min_length: 'ok', lowercase: 'ok', uppercase: 'ok', number: 'ok', symbol: 'ok' }));
  });

  it('counts characters, not UTF-16 units (an emoji is one character)', () => {
    expect(states('Aa1!Aa1!Aa1😀')['min_length']).toBe('ok');
    expect(states('Aa1!Aa1!Aa1')['min_length']).toBe('idle');
  });

  it('agrees with the regex the form validator uses', () => {
    for (const candidate of ['UnaClaveLarga123!', 'sinmayuscula123!', 'SINMINUSCULA123!', 'SinNumeroNiSimbolo', 'Corta1!', 'Sin-Numero-Larga!', 'ConEspacio Larga123!']) {
      const all = passwordChecks(candidate, '').filter((c) => c.key !== 'match').every((c) => c.state === 'ok');
      expect(all).toBe(STRONG_PASSWORD.test(candidate));
    }
  });

  it('only checks «different from the current one» on screens that have a current password', () => {
    expect('different' in states('Nueva-Clave-2026!')).toBeFalse();
    expect(states('Nueva-Clave-2026!', '', 'Actual-Clave-2026!')['different']).toBe('ok');
    expect(states('Actual-Clave-2026!', '', 'Actual-Clave-2026!')['different']).toBe('idle');
    expect(states('Nueva-Clave-2026!', '', '')['different']).toBe('idle');
  });

  it('judges the confirmation only once it is typed: ok when equal, bad when not', () => {
    expect(states('Nueva-Clave-2026!', '')['match']).toBe('idle');
    expect(states('Nueva-Clave-2026!', 'Nueva-Clave-2026!')['match']).toBe('ok');
    expect(states('Nueva-Clave-2026!', 'Nueva-Clave-2026')['match']).toBe('bad');
    expect(states('', 'algo')['match']).toBe('bad');
  });
});

describe('group validators', () => {
  const group = (current: string, password: string, confirmation = password) =>
    new FormGroup({ current_password: new FormControl(current), password: new FormControl(password), password_confirmation: new FormControl(confirmation) });

  it('differentFromCurrent flags a new password equal to the current one', () => {
    expect(differentFromCurrent()(group('Igual-Clave-2026!', 'Igual-Clave-2026!'))).toEqual({ sameAsCurrent: true });
    expect(differentFromCurrent()(group('Actual-Clave-2026!', 'Nueva-Clave-2026!'))).toBeNull();
    expect(differentFromCurrent()(group('', 'Nueva-Clave-2026!'))).toBeNull();
  });

  it('passwordsMatch flags a confirmation that differs', () => {
    expect(passwordsMatch()(group('x', 'Nueva-Clave-2026!', 'Otra'))).toEqual({ passwordMismatch: true });
    expect(passwordsMatch()(group('x', 'Nueva-Clave-2026!'))).toBeNull();
  });
});
