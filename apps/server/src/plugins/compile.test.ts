import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { compilePlugin } from './compile';

describe('compilePlugin', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-compile-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** A space's classes and `customCss` win over the plugin's own stylesheet, whatever the specificity. */
  it('ships the plugin’s stylesheet in the plugins’ layer, below the space’s', async () => {
    await fs.writeFile(path.join(dir, 'look.css'), '.marker { display: flex; }\n');
    const entry = ['import "./look.css";', 'export const widget = 1;', ''].join('\n');
    await fs.writeFile(path.join(dir, 'index.ts'), entry);

    const { hasCSS } = await compilePlugin(path.join(dir, 'index.ts'), path.join(dir, 'out'), true);

    expect(hasCSS).toBe(true);
    // What esbuild writes first in development, a comment naming the source, stays outside the block.
    expect(await fs.readFile(path.join(dir, 'out', 'index.css'), 'utf8')).toMatch(
      /^(\/\*[^*]*\*\/\s*)?@layer plitzi-sdk-plugin\{[\s\S]*\.marker[\s\S]*\}$/
    );
  });
});
