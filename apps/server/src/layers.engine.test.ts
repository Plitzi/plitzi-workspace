import { describe, expect, it } from 'vitest';

import { importReach } from './tests/importReach';

/**
 * What a page server loads never reaches the actions engine nor what runs a space's code (docs/en/server-packages.md, D11): a page server
 * deployed on its own installs neither `@plitzi/sdk-actions` nor `@plitzi/sdk-runtime` (optional peers), and loads none
 * of their code to find out. The engine is handed to it (`createPlatform`, `./platform`), never built from what it
 * imports.
 */
const ENGINE = ['@plitzi/sdk-actions', '@plitzi/sdk-runtime'];

describe('the page server’s entries', () => {
  it.each(['index.ts', 'ssr.ts'])('%s loads nothing of the engine', entry => {
    expect(importReach(entry).packages.filter(name => ENGINE.includes(name))).toEqual([]);
  });

  it('./platform does: it is what composes the two', () => {
    expect(importReach('platform.ts').packages).toContain('@plitzi/sdk-actions');
  });
});
