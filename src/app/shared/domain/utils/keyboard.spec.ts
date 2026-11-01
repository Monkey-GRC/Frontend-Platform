import { modifierKeyLabel } from './keyboard';

describe('modifierKeyLabel', () => {
  it('shows ⌘ on Apple devices', () => {
    expect(modifierKeyLabel('MacIntel')).toBe('⌘');
    expect(modifierKeyLabel('iPhone')).toBe('⌘');
  });

  it('shows Ctrl everywhere else', () => {
    expect(modifierKeyLabel('Linux x86_64')).toBe('Ctrl');
    expect(modifierKeyLabel('Win32')).toBe('Ctrl');
    expect(modifierKeyLabel('')).toBe('Ctrl');
  });
});
