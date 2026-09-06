import { beforeEach, describe, expect, it } from 'vitest';

import { readDebugPreference, writeDebugPreference } from './debugPreference';

const clear = () => {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim();
    if (name) {
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  }
};

describe('the dev-tools preference', () => {
  beforeEach(clear);

  it('shows the tools when the visitor has never said otherwise', () => {
    expect(readDebugPreference('plitzi_debug')).toBe(true);
  });

  it('reads back what was written, in the shape the server parses', () => {
    writeDebugPreference('plitzi_debug', false);
    expect(document.cookie).toContain('plitzi_debug=false');
    expect(readDebugPreference('plitzi_debug')).toBe(false);

    writeDebugPreference('plitzi_debug', true);
    expect(readDebugPreference('plitzi_debug')).toBe(true);
  });

  it('answers for its own name only, with other cookies in the jar', () => {
    document.cookie = 'plitzi_debug_4013=false; path=/';
    expect(readDebugPreference('plitzi_debug')).toBe(true);
    expect(readDebugPreference('plitzi_debug_4013')).toBe(false);
  });

  it('reads nothing on the server, where showing them is the page\'s decision alone', () => {
    expect(readDebugPreference('plitzi_debug')).toBe(true);
  });
});
