import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readTeam, setTeamOptions, TEAM_FILE } from './team';
import { makeBench } from '../../tests/runProject';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
  await bench.writeTeam({ version: 1, agents: [{ name: 'dev', roles: ['developer'], count: 2 }] });
});

afterEach(async () => {
  await bench.cleanup();
});

// A run's lead set options.launch with jq: the file came out unformatted, and every task's complete failed `format` on
// it for an hour.
describe('the team’s options', () => {
  it('are written by the CLI, each checked — none taking one out — and said before and after', async () => {
    expect(await setTeamOptions(bench.root, { launch: 'claude', freshContextAt: 120_000 })).toMatchObject({
      before: {},
      after: { launch: 'claude', freshContextAt: 120_000 }
    });
    expect((await readTeam(bench.root))?.options).toEqual({ launch: 'claude', freshContextAt: 120_000 });
    expect((await readTeam(bench.root))?.agents).toEqual([{ name: 'dev', roles: ['developer'], count: 2 }]);
    expect(await fs.readFile(path.join(bench.root, TEAM_FILE), 'utf-8')).toMatch(/^\{\n {2}"/);

    await expect(setTeamOptions(bench.root, { launch: 'emacs' })).rejects.toMatchObject({ code: 'invalid' });
    expect(await setTeamOptions(bench.root, { launch: 'claude' })).toMatchObject({ unchanged: true });
    expect((await setTeamOptions(bench.root, { launch: null, freshContextAt: null })).after).toEqual({});
  });
});
