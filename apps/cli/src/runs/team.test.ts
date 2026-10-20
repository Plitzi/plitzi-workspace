import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isRunRefusal } from './refusal';
import {
  heldRoles,
  readTeam,
  roleProblems,
  setTeamAgent,
  startedAgents,
  TEAM_FILE,
  teamSize,
  unsetTeamAgent
} from './team';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-team-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const refusalOf = async (work: Promise<unknown>): Promise<string> => {
  const refused = await work.then(
    () => undefined,
    (error: unknown) => error
  );

  return isRunRefusal(refused) ? refused.message : 'not refused';
};

describe('the team of a project’s runs', () => {
  it('is none until said, then the lead and each agent — every change said before and after', async () => {
    expect(await readTeam(root)).toBeUndefined();

    expect(await setTeamAgent(root, 'dev', { roles: ['developer'], count: 2, model: 'claude-sonnet-5-5' })).toEqual({
      name: 'dev',
      after: { name: 'dev', roles: ['developer'], count: 2, model: 'claude-sonnet-5-5' },
      file: TEAM_FILE
    });
    await setTeamAgent(root, 'design', { roles: ['designer', 'reviewer'], model: 'claude-opus-5-5' });
    await setTeamAgent(root, 'test', { roles: ['tester'] });
    expect(await setTeamAgent(root, 'lead', { model: 'claude-opus-5-5', effort: 'high' })).toMatchObject({
      after: { model: 'claude-opus-5-5', effort: 'high' }
    });

    const team = await readTeam(root);
    expect(team && teamSize(team)).toBe(4);
    expect(team && startedAgents(team).map(each => each.agent)).toEqual(['dev-1', 'dev-2', 'design-1', 'test-1']);
    expect(team && startedAgents(team)[2]).toEqual({
      agent: 'design-1',
      roles: ['designer', 'reviewer'],
      model: { model: 'claude-opus-5-5' }
    });
    // One that takes one role alone is held to it in a rehearsal; one of several is not.
    expect(team && heldRoles(team)).toEqual({ developer: 2, tester: 1 });

    // A change keeps what it does not name.
    expect(await setTeamAgent(root, 'dev', { count: 3 })).toMatchObject({
      before: { count: 2 },
      after: { roles: ['developer'], count: 3, model: 'claude-sonnet-5-5' }
    });
    expect(await unsetTeamAgent(root, 'test')).toMatchObject({ before: { name: 'test' } });
    expect((await readTeam(root))?.agents.map(each => each.name)).toEqual(['dev', 'design']);
  });

  it('refuses a plan task nobody in the team takes, with the fix', async () => {
    await setTeamAgent(root, 'dev', { roles: ['developer'] });
    const team = await readTeam(root);
    expect(
      team &&
        roleProblems(
          {
            tasks: [
              {
                id: 't-a',
                title: 'A',
                files: ['a.ts'],
                dependsOn: [],
                priority: 'low',
                estimateMinutes: 5,
                acceptance: []
              },
              {
                id: 't-b',
                title: 'B',
                role: 'writer',
                files: ['b.ts'],
                dependsOn: [],
                priority: 'low',
                estimateMinutes: 5,
                acceptance: []
              }
            ]
          },
          team
        )
    ).toEqual([expect.stringContaining('Task "t-b" is a writer\'s, and nobody in the team')]);
  });

  it('refuses a file that is not one, an agent with no roles, a name twice, and nothing to change', async () => {
    await fs.mkdir(path.join(root, '.plitzi'));
    await fs.writeFile(
      path.join(root, TEAM_FILE),
      JSON.stringify({
        version: 1,
        agents: [
          { name: 'dev', roles: [] },
          { name: 'lead', roles: ['developer'] }
        ]
      })
    );
    const said = await refusalOf(readTeam(root));
    expect(said).toContain('"dev": its roles are names');
    expect(said).toContain('"lead" is the lead’s');

    await fs.writeFile(
      path.join(root, TEAM_FILE),
      JSON.stringify({
        version: 1,
        agents: [
          { name: 'dev', roles: ['developer'] },
          { name: 'dev', roles: ['tester'] }
        ]
      })
    );
    expect(await refusalOf(readTeam(root))).toContain('"dev" is in the team twice');

    await fs.rm(path.join(root, TEAM_FILE));
    expect(await refusalOf(setTeamAgent(root, 'writer', {}))).toContain('is not in the team yet');
    await setTeamAgent(root, 'dev', { roles: ['developer'] });
    expect(await refusalOf(setTeamAgent(root, 'dev', { roles: ['developer'] }))).toContain('nothing to change');
    expect(await refusalOf(setTeamAgent(root, 'lead', { roles: ['developer'] }))).toContain('The lead is one');
    expect(await refusalOf(unsetTeamAgent(root, 'nobody'))).toContain('it has dev');
  });
});
