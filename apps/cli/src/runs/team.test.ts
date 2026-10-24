import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isRunRefusal } from './refusal';
import {
  heldRoles,
  readTeam,
  modelFor,
  parseModelChoice,
  refreshTeamAbout,
  roleProblems,
  teamProblems,
  setTeamAgent,
  startedAgents,
  TEAM_ABOUT,
  TEAM_FILE,
  TEAM_SCHEMA,
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
    // A tester named with no model starts on the strongest: what its tests miss gets through (Carlos).
    expect(await setTeamAgent(root, 'test', { roles: ['tester'] })).toMatchObject({
      after: { name: 'test', roles: ['tester'], model: 'claude-opus-5-5' }
    });
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
    // A model said is the file's, whatever the role: the default is only for an entry that names none.
    expect(await setTeamAgent(root, 'test', { model: 'claude-sonnet-5-5' })).toMatchObject({
      after: { model: 'claude-sonnet-5-5' }
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

  it('refuses a file that is not one, an agent with no roles, a name twice — and says nothing to change', async () => {
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
    expect(await setTeamAgent(root, 'dev', { roles: ['developer'] })).toMatchObject({ unchanged: true });
    expect(await refusalOf(setTeamAgent(root, 'lead', { roles: ['developer'] }))).toContain('The leads take no roles');
    expect(await refusalOf(unsetTeamAgent(root, 'nobody'))).toContain('it has dev');
  });

  it('writes what its fields mean as this CLI says it, and brings an older one up — its agents as they are', async () => {
    const file = path.join(root, TEAM_FILE);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const agents = [{ name: 'dev', roles: ['developer'], count: 3 }];
    await fs.writeFile(file, JSON.stringify({ version: 1, agents, about: { lead: 'The lead is one' } }));

    expect(await refreshTeamAbout(root, false)).toBe(true);
    expect(JSON.parse(await fs.readFile(file, 'utf-8'))).toMatchObject({ about: { lead: 'The lead is one' } });
    expect(await refreshTeamAbout(root, true)).toBe(true);
    expect(JSON.parse(await fs.readFile(file, 'utf-8'))).toEqual({
      $schema: TEAM_SCHEMA,
      version: 1,
      agents,
      about: TEAM_ABOUT
    });
    expect(await refreshTeamAbout(root, true)).toBe(false);

    // Any write of the file says it as this CLI does.
    await fs.writeFile(file, JSON.stringify({ version: 1, agents, about: { lead: 'The lead is one' } }));
    await setTeamAgent(root, 'lead', { count: 2 });
    expect(JSON.parse(await fs.readFile(file, 'utf-8'))).toMatchObject({ lead: { count: 2 }, about: TEAM_ABOUT });
  });

  it('says every wrong or unknown field at once, the one meant beside a typo', () => {
    expect(
      teamProblems({
        version: 1,
        lead: { modle: 'claude-opus-5-5' },
        agents: [
          { name: 'dev', roles: ['developer'], cuont: 2 },
          { name: 'lead', roles: ['designer'] }
        ],
        extra: true
      })
    ).toEqual([
      '"extra" is no field of it (it takes version, lead, agents, options, about)',
      '"lead": "modle" is no field of it — did you mean "model"? (it takes model, effort, count)',
      '"dev": "cuont" is no field of it — did you mean "count"? (it takes name, roles, count, min, model, effort, session, resumeSession)',
      '"lead" is the lead’s: give the lead its model under "lead", and the agent another name'
    ]);
    expect(teamProblems({ $schema: TEAM_SCHEMA, version: 1, agents: [{ name: 'dev', roles: ['developer'] }] })).toEqual(
      []
    );
    expect(teamProblems({ version: 1, agents: [{ name: 'dev', roles: ['developer'], session: 'yes' }] })).toEqual([
      '"dev": its session is task, context, keep — when it is started again with a fresh context: after each task or review (the default), past options.freshContextAt, or never'
    ]);
    // Renamed: refused saying what it is now, never read as nothing.
    expect(teamProblems({ version: 1, agents: [{ name: 'dev', roles: ['developer'], sessionPerTask: true }] })).toEqual(
      [
        '"dev": "sessionPerTask" is gone: a fresh session after each task or review is every agent\'s now — remove it ("session": "context" starts it again only past options.freshContextAt, "keep" never)'
      ]
    );
    expect(teamProblems({ version: 1, agents: [], options: { freshContextAt: 1000 } })).toEqual([
      '"options": "freshContextAt" is the context, in tokens, past which an agent is started again fresh — a whole number from 60000; 250000 when not said'
    ]);
    expect(teamProblems({ version: 1, agents: [{ name: 'dev', roles: ['developer'], resumeSession: 'yes' }] })).toEqual(
      ['"dev": its resumeSession is true — its own session resumed after it died with a task in hand — or false']
    );
  });

  // encore: options.startGraceMinutes was checked but never read — readTeam kept designReview alone.
  it('reads every option the file says, each as it is valid', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-team-'));
    try {
      await fs.mkdir(path.join(root, '.plitzi'));
      await fs.writeFile(
        path.join(root, '.plitzi', 'team.json'),
        JSON.stringify({
          version: 1,
          agents: [{ name: 'dev', roles: ['developer'] }],
          options: { designReview: 'light', startGraceMinutes: 5, launch: 'claude' }
        })
      );

      expect((await readTeam(root))?.options).toEqual({
        designReview: 'light',
        startGraceMinutes: 5,
        launch: 'claude'
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  // encore: every agent started again after the machine went down read "no signal" at once, its last word from before.
  it('takes how long an agent just started may say nothing, from 1 to 30 minutes', () => {
    const agents = [{ name: 'dev', roles: ['developer'] }];

    expect(teamProblems({ version: 1, agents, options: { startGraceMinutes: 5 } })).toEqual([]);
    for (const startGraceMinutes of [0, 31, 2.5, '3']) {
      expect(teamProblems({ version: 1, agents, options: { startGraceMinutes } })).toEqual([
        '"options": "startGraceMinutes" is a whole number from 1 to 30 — how long an agent just started may say nothing'
      ]);
    }
  });

  // velada-now: a designer's strictest review took 83 steps, more than the task it reviewed — how close is the team's.
  it('says how closely a designer reviews, and refuses a level it does not know', () => {
    const team = { version: 1, agents: [{ name: 'design', roles: ['designer'] }] };

    expect(teamProblems({ ...team, options: { designReview: 'light' } })).toEqual([]);
    expect(teamProblems({ ...team, options: { designReview: 'pixel' } })).toEqual([
      '"options": "designReview" is light, standard, high — how closely a designer reviews'
    ]);
    expect(teamProblems({ ...team, options: { designRevew: 'light' } })[0]).toContain('did you mean "designReview"?');
  });

  it('is described alike by the schema an editor checks it with', async () => {
    const schema: unknown = JSON.parse(
      await fs.readFile(new URL('../../schemas/team.schema.json', import.meta.url), 'utf-8')
    );
    const props = (value: unknown, ...keys: string[]): string[] => {
      let at: unknown = value;
      for (const key of keys) {
        at = typeof at === 'object' && at !== null ? (at as Record<string, unknown>)[key] : undefined;
      }

      return typeof at === 'object' && at !== null ? Object.keys(at).sort() : [];
    };

    expect(props(schema, 'properties')).toEqual(['$schema', 'about', 'agents', 'lead', 'options', 'version']);
    expect(props(schema, 'properties', 'options', 'properties')).toEqual([
      'designReview',
      'freshContextAt',
      'launch',
      'startGraceMinutes'
    ]);
    expect(props(schema, 'properties', 'lead', 'properties')).toEqual(['count', 'effort', 'model']);
    expect(props(schema, 'properties', 'agents', 'items', 'properties')).toEqual([
      'count',
      'effort',
      'min',
      'model',
      'name',
      'resumeSession',
      'roles',
      'session'
    ]);
  });

  it('starts an agent a level when the team names a model a level, each with its model', () => {
    const team = {
      version: 1 as const,
      agents: [
        { name: 'design', roles: ['designer'], model: { standard: 'claude-sonnet-5-5', high: 'claude-opus-5-5' } }
      ]
    };
    expect(teamProblems(team)).toEqual([]);
    expect(startedAgents(team)).toEqual([
      { agent: 'design-1-standard', roles: ['designer'], model: { model: 'claude-sonnet-5-5' }, quality: 'standard' },
      { agent: 'design-1-high', roles: ['designer'], model: { model: 'claude-opus-5-5' }, quality: 'high' }
    ]);
    // A level none was named for takes the next one up — a stronger model — else the strongest there is.
    expect(modelFor(team.agents[0].model, 'light')).toBe('claude-sonnet-5-5');
    expect(modelFor('claude-haiku-5-5', 'high')).toBe('claude-haiku-5-5');
    expect(parseModelChoice('standard=claude-sonnet-5-5,high=claude-opus-5-5')).toEqual({
      standard: 'claude-sonnet-5-5',
      high: 'claude-opus-5-5'
    });
    expect(
      teamProblems({ version: 1, agents: [{ name: 'dev', roles: ['developer'], model: { best: 'x' } }] })[0]
    ).toContain('one a level');
  });
});
