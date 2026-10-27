import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scratchOf } from './scratch';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-scratch-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const write = async (file: string, text = ''): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
};

// A run's report said "1250 scripts written beside the CLI": four copies of the project, and about ten probes.
describe('an agent’s scratch', () => {
  it('says a copy of the project as one, and only what the agent wrote in it as its scripts', async () => {
    await write('package.json', '{}');
    await write('src/space/index.ts');
    await write('src/functions/rooms.ts');
    const scout = 'tmp/plitzi-runs/r1/scratch/scout-1';
    await write(`${scout}/probe.mjs`);
    await write(`${scout}/copy/package.json`, '{}');
    await write(`${scout}/copy/src/space/index.ts`);
    await write(`${scout}/copy/src/functions/rooms.ts`);
    await write(`${scout}/copy/tmp/.sdk-plugins/chat@1.0.0/index.js`);
    await write(`${scout}/copy/tmp/gate-probe.mjs`);
    await write(`${scout}/copy/pw-scout.config.ts`);

    expect(await scratchOf(path.join(root, 'tmp/plitzi-runs/r1/scratch'))).toEqual([
      {
        agent: 'scout-1',
        scripts: ['copy/pw-scout.config.ts', 'copy/tmp/gate-probe.mjs', 'probe.mjs'],
        packages: [],
        copies: ['copy']
      }
    ]);
  });

  // a run counted the scout's `run preview --copy` folder as a copy made by hand.
  it('counts no copy the CLI made, and still reads what the agent wrote in it', async () => {
    await write('package.json', '{}');
    await write('src/space/index.ts');
    const scout = 'tmp/plitzi-runs/r1/scratch/scout-1';
    await write(`${scout}/run-copy/package.json`, '{}');
    await write(`${scout}/run-copy/src/space/index.ts`);
    await write(`${scout}/run-copy/.plitzi-run-copy`, '{}');
    await write(`${scout}/run-copy/probe.mjs`);

    expect(await scratchOf(path.join(root, 'tmp/plitzi-runs/r1/scratch'))).toEqual([
      { agent: 'scout-1', scripts: ['run-copy/probe.mjs'], packages: [], copies: [] }
    ]);
  });
});
