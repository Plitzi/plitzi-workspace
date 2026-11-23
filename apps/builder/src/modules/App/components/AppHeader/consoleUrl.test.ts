import { describe, expect, it } from 'vitest';

import { consoleUrlOf } from './consoleUrl';

describe('the way back from the builder', () => {
  it('is the space’s console by its address name, and by its id until the space has loaded', () => {
    expect(consoleUrlOf('https://ssr.plitzi.local', 'split-roast', 35)).toBe(
      'https://ssr.plitzi.local/spaces/split-roast'
    );
    expect(consoleUrlOf('https://plitzi.com', '', 35)).toBe('https://plitzi.com/spaces/35');
    expect(consoleUrlOf('https://plitzi.com', undefined, 35)).toBe('https://plitzi.com/spaces/35');
  });
});
