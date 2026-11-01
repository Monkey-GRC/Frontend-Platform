import { displayNameOf, initialsOf } from './initials';

describe('iniciales y nombre de la persona', () => {
  it('usa nombre y apellido cuando los hay', () => {
    expect(initialsOf({ name: 'Héctor', last_name: 'Ríos', email: 'hector@empresa.com' })).toBe('HR');
    expect(displayNameOf({ name: 'Héctor', last_name: 'Ríos', email: 'hector@empresa.com' })).toBe('Héctor Ríos');
  });

  it('con varios nombres o apellidos toma el primero y el último', () => {
    expect(initialsOf({ name: 'Ana María', last_name: 'Pérez Gómez', email: 'a@x.co' })).toBe('AG');
  });

  it('con el nombre completo en un solo campo toma las dos primeras palabras', () => {
    expect(initialsOf({ name: 'Héctor Ríos', last_name: null, email: 'h@x.co' })).toBe('HR');
  });

  it('con una sola palabra toma sus dos primeras letras', () => {
    expect(initialsOf({ name: 'Nelson', last_name: null, email: 'n@x.co' })).toBe('NE');
  });

  it('sin nombre usa el correo: dos partes → una letra de cada una', () => {
    expect(initialsOf({ name: null, last_name: null, email: 'ana.perez@empresa.com' })).toBe('AP');
    expect(initialsOf({ name: '  ', last_name: '', email: 'juan_lopez@empresa.com' })).toBe('JL');
    expect(displayNameOf({ name: null, last_name: null, email: 'ana.perez@empresa.com' })).toBe('ana.perez@empresa.com');
  });

  it('sin nombre y con una sola parte en el correo usa sus dos primeras letras', () => {
    expect(initialsOf({ name: null, last_name: null, email: 'soporte@empresa.com' })).toBe('SO');
    expect(initialsOf({ name: null, last_name: null, email: 'x@empresa.com' })).toBe('X');
  });

  it('nunca devuelve vacío', () => {
    expect(initialsOf({ name: null, last_name: null, email: '@x.co' })).toBe('?');
  });
});
