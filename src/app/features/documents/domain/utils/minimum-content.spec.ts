import { numberedItems } from './minimum-content';

describe('numberedItems', () => {
  it('splits a numbered text written in lines', () => {
    expect(numberedItems('1- Objetivo\n2- Alcance\n3- Responsables')).toEqual(['Objetivo', 'Alcance', 'Responsables']);
  });

  it('splits a numbered text written in running text, with any of the separators', () => {
    expect(numberedItems('1. Objetivo 2. Alcance y límites 3) Responsables')).toEqual(['Objetivo', 'Alcance y límites', 'Responsables']);
  });

  it('keeps a number inside a sentence in its item', () => {
    expect(numberedItems('1- Revisión cada 12 meses 2- Aprobación')).toEqual(['Revisión cada 12 meses', 'Aprobación']);
  });

  it('is null when the numbers are not consecutive from 1, as with an article reference in the text', () => {
    expect(numberedItems('1. Política. Ver artículo 5. Detalle')).toBeNull();
    expect(numberedItems('2- Alcance 3- Responsables')).toBeNull();
  });

  it('is null for a plain text, a single point or nothing', () => {
    expect(numberedItems('Debe incluir objetivo y alcance.')).toBeNull();
    expect(numberedItems('1- Solo uno')).toBeNull();
    expect(numberedItems(null)).toBeNull();
  });
});
