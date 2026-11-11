import { emptyDraft, inputFromDraft } from './organizational-context.models';

describe('inputFromDraft (información organizacional)', () => {
  const complete = { ...emptyDraft(), description: ' Empresa ', size: 'small', industry: 'tech', business_model: 'saas', compliance_maturity: 'initial' };

  it('devuelve null si falta una respuesta obligatoria', () => {
    expect(inputFromDraft(emptyDraft())).toBeNull();
    expect(inputFromDraft({ ...complete, industry: null })).toBeNull();
  });

  it('con todo contestado arma lo que se envía', () => {
    expect(inputFromDraft(complete)).toEqual(jasmine.objectContaining({ description: 'Empresa', size: 'small', industry: 'tech', business_model: 'saas', compliance_maturity: 'initial' }));
  });
});
