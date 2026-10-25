import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { specSelectorFindings } from './specSelectors';

import type { SpaceHandles } from '@plitzi/sdk-authoring';

let root: string;

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/** The handles of a space with an element and a component's instance — the two selectors a test may need. */
const handles = {
  elements: {
    'room-title': { selector: '[data-plitzi-el="room-title"]' },
    'room-stats-inner': { selector: '[data-plitzi-instance="room-stats-inner"]' }
  }
} as unknown as SpaceHandles;

// encore-4: a spec looked for an instance by data-plitzi-el, matched nothing, and its toBeHidden() passed.
describe('a test’s selector of a component’s instance', () => {
  it('is said where it is written, with the selector that finds it', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-selectors-'));
    await fs.mkdir(path.join(root, 'visual'));
    await fs.mkdir(path.join(root, 'node_modules'));
    await fs.writeFile(
      path.join(root, 'visual', 'room.spec.ts'),
      [
        'await expect(page.locator(\'[data-plitzi-el="room-title"]\')).toBeVisible();',
        'await expect(page.locator(\'[data-plitzi-el="room-stats-inner"]\')).toBeHidden();'
      ].join('\n')
    );
    await fs.writeFile(path.join(root, 'node_modules', 'x.spec.ts'), '[data-plitzi-el="room-stats-inner"]');

    const found = await specSelectorFindings(root, handles);

    expect(found).toMatchObject([{ code: 'selector-instance', file: 'visual/room.spec.ts', line: 2 }]);
    expect(found[0].message).toContain('`[data-plitzi-instance="room-stats-inner"]`');
  });
});
