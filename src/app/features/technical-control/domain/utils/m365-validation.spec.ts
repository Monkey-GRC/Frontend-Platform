import { cleanM365Guid, isM365Guid } from './m365-validation';

describe('m365-validation', () => {
  it('accepts a tenant or application id in any case and rejects the usual mistakes', () => {
    expect(isM365Guid('3f2a91c4-7b6d-4e0a-9c11-5d8e2f7a0b13')).toBe(true);
    expect(isM365Guid(' 3F2A91C4-7B6D-4E0A-9C11-5D8E2F7A0B13 ')).toBe(true);
    for (const bad of ['', 'contoso.onmicrosoft.com', '123456789012', '3f2a91c4-7b6d-4e0a-9c11-5d8e2f7a0b1', '3f2a91c47b6d4e0a9c115d8e2f7a0b13', 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz']) {
      expect(isM365Guid(bad)).toBe(false);
    }
  });

  it('cleans a pasted id: no spaces, no braces, lowercase', () => {
    expect(cleanM365Guid(' {3F2A91C4-7B6D-4E0A-9C11-5D8E2F7A0B13}\n')).toBe('3f2a91c4-7b6d-4e0a-9c11-5d8e2f7a0b13');
  });
});
