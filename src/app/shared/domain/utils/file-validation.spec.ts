import { acceptedTypesLabel, formatBytes, validateFile } from './file-validation';

describe('validateFile', () => {
  const rules = { accept: ['.pdf', '.docx'], maxBytes: 25 * 1024 * 1024 };

  it('accepts a file of an allowed type and size', () => {
    expect(validateFile({ name: 'Politica.PDF', size: 1000 }, rules)).toBeNull();
    expect(validateFile({ name: 'a.docx', size: 25 * 1024 * 1024 }, rules)).toBeNull();
  });

  it('rejects a type that is not allowed, saying which ones are', () => {
    expect(validateFile({ name: 'foto.png', size: 1000 }, rules)).toEqual({ key: 'COMMON.FILE.ERROR_TYPE', params: { types: 'PDF, DOCX' } });
  });

  it('rejects a file over the size limit, saying the limit', () => {
    expect(validateFile({ name: 'a.pdf', size: 25 * 1024 * 1024 + 1 }, rules)).toEqual({ key: 'COMMON.FILE.ERROR_SIZE', params: { max: '25 MB' } });
  });

  it('rejects an empty file', () => {
    expect(validateFile({ name: 'a.pdf', size: 0 }, rules)?.key).toBe('COMMON.FILE.ERROR_EMPTY');
  });

  it('checks the type before the size', () => {
    expect(validateFile({ name: 'a.exe', size: 999_999_999 }, rules)?.key).toBe('COMMON.FILE.ERROR_TYPE');
  });

  it('allows any type when no list is given', () => {
    expect(validateFile({ name: 'a.xyz', size: 10 }, { accept: [], maxBytes: 100 })).toBeNull();
  });

  it('formats sizes for people', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1536 * 1024)).toBe('1.5 MB');
    expect(acceptedTypesLabel(['.pdf', '.docx'])).toBe('PDF, DOCX');
  });
});
