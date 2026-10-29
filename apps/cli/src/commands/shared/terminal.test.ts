import { describe, expect, it } from 'vitest';

import { shellWord } from './terminal';

// A run's designer pasted `plitzi task look t-cyclone-panel / /?sample=active` into zsh and read "no matches found".
describe('a word of a command printed to be pasted', () => {
  it('is quoted when a shell would read it otherwise, and left as it is when not', () => {
    expect(shellWord('/rooms/new')).toBe('/rooms/new');
    expect(shellWord('<page…>')).toBe('<page…>');
    expect(shellWord('/?sample=active')).toBe("'/?sample=active'");
    expect(shellWord('/rooms?genre=jazz&q=night')).toBe("'/rooms?genre=jazz&q=night'");
    expect(shellWord("/r/dj's-night")).toBe("'/r/dj'\\''s-night'");
  });
});
