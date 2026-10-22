import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assertRoles, callerFlag, identifiedAgents, identify, issueToken, tokenFile } from './identity';
import { runPaths } from './paths';
import { makeBench } from '../tests/runProject';

import type { Claim } from './identity';
import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
  await bench.writeTeam({
    version: 1,
    agents: [
      { name: 'dev', roles: ['developer'], count: 2 },
      { name: 'design', roles: ['designer'] }
    ]
  });
});

afterEach(async () => {
  await bench.cleanup();
});

const RUN = 'es-launch';
const at = new Date('2026-10-22T01:00:00Z');
const paths = () => runPaths(bench.root, RUN);
const who = (claim: Claim) => identify(bench.root, paths(), RUN, claim, at);

describe('who calls a run’s command, proved', () => {
  it('gives a name its token at its first command, and refuses the name alone after', async () => {
    const first = await who({ kind: 'name', said: 'design-1' });
    expect(first.agent).toBe('design-1');
    expect(first.issued?.token).toMatch(/^es-launch\.@design-1\.[0-9a-f]{32}$/);
    expect(await bench.read(`tmp/plitzi-runs/${RUN}/scratch/design-1/token`)).toBe(`${first.issued?.token ?? ''}\n`);
    expect(first.issued?.file).toBe(tokenFile(paths(), 'design-1'));

    await expect(who({ kind: 'name', said: 'design-1' })).rejects.toMatchObject({
      code: 'identity',
      message: expect.stringContaining('design-1 has a token on this run') as unknown
    });
    expect(await who({ kind: 'agent', token: first.issued?.token ?? '' })).toEqual({ agent: 'design-1' });
    expect(await identifiedAgents(paths())).toEqual(['design-1']);
  });

  it('refuses a token under another’s name, of another run, or with a secret not its own', async () => {
    const { issued } = await who({ kind: 'name', said: 'dev-1' });
    const token = issued?.token ?? '';

    await expect(who({ kind: 'agent', token, said: 'lead' })).rejects.toMatchObject({
      code: 'identity',
      message: expect.stringContaining("Your token is dev-1's: --agent lead says otherwise") as unknown
    });
    await expect(
      identify(bench.root, runPaths(bench.root, 'other'), 'other', { kind: 'agent', token }, at)
    ).rejects.toMatchObject({ message: expect.stringContaining('not of "other"') as unknown });
    const forged = token.replace(/.$/, last => (last === '0' ? '1' : '0'));
    await expect(who({ kind: 'agent', token: forged })).rejects.toMatchObject({
      code: 'identity',
      message: expect.stringContaining("no one's") as unknown
    });
  });

  it('keeps the lead’s name the lead’s once its token is made, and a person a terminal’s', async () => {
    await issueToken(paths(), RUN, 'lead', at);

    await expect(who({ kind: 'name', said: 'lead' })).rejects.toMatchObject({ code: 'identity' });
    await expect(who({ kind: 'name', said: 'person' })).rejects.toMatchObject({
      message: expect.stringContaining('A person is one at a terminal') as unknown
    });
    await expect(who({ kind: 'none' })).rejects.toMatchObject({
      message: expect.stringContaining('Who is calling?') as unknown
    });
    expect(await who({ kind: 'person' })).toEqual({ agent: 'person' });
  });

  it('names a task’s caller by its token’s owner, and refuses another name on it', async () => {
    expect(await who({ kind: 'task', holder: 'dev-1', fallback: 'agent' })).toEqual({ agent: 'dev-1' });
    await expect(who({ kind: 'task', holder: 'dev-1', said: 'lead', fallback: 'agent' })).rejects.toMatchObject({
      message: expect.stringContaining("This task's token is dev-1's") as unknown
    });
    // A token nobody holds now — cut, reassigned — is refused by the step it asks for; named as it was.
    expect(await who({ kind: 'task', said: 'lead', fallback: 'dev-2' })).toEqual({ agent: 'dev-2' });
  });

  it('takes only the team’s names, and holds each to its roles', async () => {
    await expect(who({ kind: 'name', said: 'intruder' })).rejects.toMatchObject({
      message: expect.stringContaining(
        "intruder is no agent of this project's team: its agents are lead, dev-1, dev-2, design-1"
      ) as unknown
    });

    await expect(assertRoles(bench.root, 'dev-1', ['designer'])).rejects.toMatchObject({
      code: 'identity',
      message: expect.stringContaining('dev-1 is a developer of the team, not a designer') as unknown
    });
    await expect(assertRoles(bench.root, 'design-1', ['designer'])).resolves.toBeUndefined();
    // Not of the team — the lead, a co-lead — its roles are no team's to hold.
    await expect(assertRoles(bench.root, 'lead', ['lead'])).resolves.toBeUndefined();
  });

  it('says how to start an agent again: by its name the first time, by its kept token after', () => {
    expect(callerFlag(RUN, 'dev-2', [])).toBe('--agent dev-2');
    expect(callerFlag(RUN, 'dev-2', ['dev-2'])).toBe('--token "$(cat tmp/plitzi-runs/es-launch/scratch/dev-2/token)"');
  });
});
