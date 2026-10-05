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

  it('carries a file imported whole inside the module — a worker’s source — and watches it', async () => {
    await fs.writeFile(path.join(dir, 'worker.js'), 'postMessage("ready");\n');
    await fs.writeFile(path.join(dir, 'index.ts'), 'export { default as source } from "./worker.js?raw";\n');

    const { inputs } = await compilePlugin(path.join(dir, 'index.ts'), path.join(dir, 'out'), true);

    const built = (await import(path.join(dir, 'out', 'index.js'))) as { source: string };
    expect(built.source).toBe('postMessage("ready");\n');
    expect(await fs.readdir(path.join(dir, 'out'))).toEqual(['index.js']);
    // esbuild reports real paths: a temporary folder can sit behind a symlink (`/var` on macOS).
    expect(inputs).toContain(await fs.realpath(path.join(dir, 'worker.js')));
  });
});
