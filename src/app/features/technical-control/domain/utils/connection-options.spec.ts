import { ConnectionOption } from '@shared/domain/models/catalog.models';
import { defaultOption, isSelectable } from './connection-options';

const opt = (value: string, availability: ConnectionOption['availability'], tags: ConnectionOption['tags'] = []): ConnectionOption => ({ value, label: value, description: '', availability, tags });

describe('connection-options', () => {
  it('preselects the recommended available option, else the first available one', () => {
    expect(defaultOption([opt('a', 'available'), opt('b', 'available', ['recommended'])])).toBe('b');
    expect(defaultOption([opt('a', 'coming_soon', ['recommended']), opt('b', 'available'), opt('c', 'available')])).toBe('b');
  });

  it('preselects nothing when no option is available', () => {
    expect(defaultOption([opt('a', 'coming_soon')])).toBeNull();
    expect(defaultOption([])).toBeNull();
  });

  it('only an available option can be chosen', () => {
    const options = [opt('a', 'available'), opt('b', 'coming_soon')];
    expect(isSelectable(options, 'a')).toBeTrue();
    expect(isSelectable(options, 'b')).toBeFalse();
    expect(isSelectable(options, null)).toBeFalse();
  });
});
