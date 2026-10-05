import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { copyPluginStylesheet } from './copy';

describe('copyPluginStylesheet', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-copy-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** A stylesheet the server did not build sits where a compiled one does: below the space's styles. */
  it('copies a plugin’s stylesheet into the plugins’ layer', async () => {
    const source = path.join(dir, 'chart.css');
    await fs.writeFile(source, '.bar{fill:red}');
    await fs.mkdir(path.join(dir, 'out'));

    await copyPluginStylesheet(source, path.join(dir, 'out'));

    expect(await fs.readFile(path.join(dir, 'out', 'index.css'), 'utf8')).toBe(
      '@layer plitzi-sdk-plugin{.bar{fill:red}}'
    );
  });
});
