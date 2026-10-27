import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeConnection } from '../../account/connection';
import { fakePlatform } from '../../tests/fakePlatform';

import type { FakePlatform } from '../../tests/fakePlatform';
import type { SpaceActivityPage } from '@plitzi/sdk-shared/activity';

/** `plitzi space activity`: what happened on the space, read once or followed — each page validated before it is read. */

let platform: FakePlatform;
let home: string;
const said = { out: '', err: '' };

vi.mock('../../account/oauth', async importOriginal => ({
  ...(await importOriginal<typeof import('../../account/oauth')>()),
  openBrowser: () => undefined
}));

const { activity, followActivity } = await import('./activity');

const page = (cursor: string, overrides: Partial<SpaceActivityPage> = {}): SpaceActivityPage => ({
  activity: [
    {
      kind: 'change',
      at: Date.UTC(2026, 9, 15, 10, 0, 0),
      seq: 12,
      document: 'schema',
      author: { userId: 2, name: 'ana' },
      origin: 'builder',
      summary: 'Changed the content of text “hero”',
      touched: ['hero']
    }
  ],
  cursor,
  more: false,
  waitedMs: 0,
  skippedMine: 0,
  ...overrides
});

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-activity-'));
  process.env.XDG_CONFIG_HOME = path.join(home, 'config');
  platform = await fakePlatform();
  platform.valid.add('live');
  await writeConnection({
    api: platform.api,
    grant: { clientId: 'c', accessToken: 'live' },
    space: { id: 3, name: 'Shop', permanentUrl: 'shop' }
  });
  said.out = '';
  said.err = '';
  vi.spyOn(console, 'log').mockImplementation((line: string) => {
    said.out += `${line}\n`;
  });
  vi.spyOn(console, 'error').mockImplementation((line: string) => {
    said.err += `${line}\n`;
  });
  process.exitCode = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await platform.close();
  await fs.rm(home, { recursive: true, force: true });
  process.exitCode = undefined;
});

describe('plitzi space activity', () => {
  it('says the latest in a line each, and how to read what comes next', async () => {
    platform.activity.pages.push(page('c1', { skippedMine: 2 }));

    await activity({});

    expect(said.out).toContain('ana in the builder, schema #12: Changed the content of text “hero”');
    expect(said.out).toContain('2 of your own pushes left out (--mine keeps them)');
    expect(said.out).toContain('plitzi space activity --after c1');
    expect(platform.activity.asked).toEqual(['']);
  });

  it('answers the page whole with --json, and asks for what it was told to', async () => {
    platform.activity.pages.push(page('c1'));

    await activity({ json: true, after: 'c0', mine: true, limit: 5 });

    expect(JSON.parse(said.out) as unknown).toEqual(page('c1'));
    expect(new URLSearchParams(platform.activity.asked[0]).toString()).toBe('after=c0&limit=5&mine=true');
  });

  it('says it when there is nothing yet', async () => {
    platform.activity.pages.push(page('c1', { activity: [] }));

    await activity({});

    expect(said.out).toContain('Nothing on Shop yet.');
  });

  it('follows from the cursor it was given, waiting the most a call holds, a page a line', async () => {
    platform.activity.pages.push(page('c2'), page('c3', { activity: [] }), page('c4'));
    const stop = new AbortController();
    const followed = followActivity(
      { api: platform.api, grant: { clientId: 'c', accessToken: 'live' } },
      3,
      { after: 'c1', json: true },
      stop.signal
    );
    await vi.waitFor(() => {
      expect(said.out.trim().split('\n')).toHaveLength(2);
    });
    stop.abort();
    await followed;

    const lines = said.out
      .trim()
      .split('\n')
      .map(line => (JSON.parse(line) as SpaceActivityPage).cursor);
    // The empty page in between is not a line: nothing happened.
    expect(lines).toEqual(['c2', 'c4']);
    expect(platform.activity.asked.slice(0, 3).map(query => new URLSearchParams(query).get('after'))).toEqual([
      'c1',
      'c2',
      'c3'
    ]);
    expect(new URLSearchParams(platform.activity.asked[0]).get('wait')).toBe('50');
  });

  it('stops on a cursor the platform did not give out, saying what to do', async () => {
    await followActivity({ api: platform.api, grant: { clientId: 'c', accessToken: 'live' } }, 3, { after: 'made-up' });

    expect(said.err).toContain('read the activity again without `after`');
    expect(process.exitCode).toBe(1);
  });
});
