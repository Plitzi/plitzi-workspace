import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { unreadByName } from './usage';

let runDir: string;

beforeEach(async () => {
  runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-usage-'));
  await fs.mkdir(path.join(runDir, 'messages'));
  await fs.mkdir(path.join(runDir, 'agents-read'));
});

afterEach(async () => {
  await fs.rm(runDir, { recursive: true, force: true });
});

const say = (id: string, to: string): Promise<void> =>
  fs.writeFile(path.join(runDir, 'messages', `${id}.json`), JSON.stringify({ id, to, from: 'lead', text: 'x' }));

// lx-copy: design-2 measured on through a review the lead had withdrawn — a page command reads no inbox, and the
// message waited for its verdict, refused three times.
describe('the messages a page command points its agent at', () => {
  it('counts what was said to the agent by name and not read — not another’s, not what it read', async () => {
    await say('m1', '@design-2');
    await say('m2', '@design-2');
    await say('m3', '@dev-1');
    await say('m4', 't-blog');
    await fs.writeFile(path.join(runDir, 'agents-read', 'design-2.json'), JSON.stringify(['m1']));

    expect(unreadByName(runDir, 'design-2')).toBe(1);
    expect(unreadByName(runDir, 'dev-1')).toBe(1);
    expect(unreadByName(runDir, 'lead')).toBe(0);
    expect(unreadByName(runDir, 'unnamed')).toBe(0);
  });

  it('counts none for a run with no messages folder', async () => {
    await fs.rm(path.join(runDir, 'messages'), { recursive: true });

    expect(unreadByName(runDir, 'dev-1')).toBe(0);
  });
});
