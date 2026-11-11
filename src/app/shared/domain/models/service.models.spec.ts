import { emptyServiceDraft, inputFromDraft } from './service.models';

describe('inputFromDraft (servicio)', () => {
  it('devuelve null si falta el tipo o la disponibilidad esperada', () => {
    expect(inputFromDraft(emptyServiceDraft())).toBeNull();
    expect(inputFromDraft({ ...emptyServiceDraft(), type: 'saas' })).toBeNull();
  });

  it('con ambos arma lo que se envía', () => {
    const input = inputFromDraft({ ...emptyServiceDraft(), name: ' A ', type: 'saas', expected_availability: '99.9' });
    expect(input).toEqual(jasmine.objectContaining({ name: 'A', type: 'saas', expected_availability: '99.9' }));
  });
});
