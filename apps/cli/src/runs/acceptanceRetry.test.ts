import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkAcceptance } from './acceptance';

const folders: string[] = [];

afterEach(async () => {
  await Promise.all(folders.splice(0).map(folder => fs.rm(folder, { recursive: true, force: true })));
});

/**
 * A line that asks a slow server fails one run in many: la-velada's finish failed a different line each time a CDN was
 * busy. Each failed line runs once more, and one that passes only then says so.
 */
describe('checkAcceptance', () => {
  it('runs a failed line once more: passed then, it says the first failed; failed twice, it is broken', async () => {
    const work = await fs.mkdtemp(path.join(os.tmpdir(), 'acceptance-retry-'));
    folders.push(work);
    // Fails until it has run once: a file left by the first run.
    const flaky =
      "node -e \"const fs=require('fs');if(fs.existsSync('ran'))process.exit(0);fs.writeFileSync('ran','');console.log('timed out');process.exit(1)\"";

    const results = await checkAcceptance(
      [
        { said: 'Slow once', check: flaky },
        { said: 'Broken', check: 'echo still broken; exit 1' },
        { said: 'Fine', check: 'exit 0' }
      ],
      { work, root: work, cache: path.join(work, 'cache') }
    );

    expect(results).toEqual([
      { said: 'Slow once', check: flaky, ok: true, firstFailed: ['timed out'] },
      { said: 'Broken', check: 'echo still broken; exit 1', ok: false, output: ['still broken'] },
      { said: 'Fine', check: 'exit 0', ok: true }
    ]);
  });
});
