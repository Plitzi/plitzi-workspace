import { describe, expect, it } from 'vitest';

import serverCodeKindOf from './serverCodeKindOf';

describe('serverCodeKindOf', () => {
  it('reads what a file of server code is from its folder', () => {
    expect(serverCodeKindOf('pizarra/server/runtimes/abc.bundle')).toBe('Runtime');
    expect(serverCodeKindOf('blog/server/functions/source/abc.json')).toBe('Functions source');
    expect(serverCodeKindOf('blog/server/functions/bundles/abc.js')).toBe('Functions bundle');
    expect(serverCodeKindOf('blog/server/other/abc')).toBe('Server code');
  });
});
