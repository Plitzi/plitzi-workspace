import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REFUSAL_EXIT_CODES } from '../runs/refusal';
import { STARTER_TEAM } from '../runs/team';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';

import type { Bench } from '../tests/runProject';

/**
 * The run's commands as a harness meets them: the CLI itself, one process per command, each answering JSON and leaving
 * the exit code its refusal names — so a harness that reads no output still knows what to do.
 */

const CLI = path.resolve(import.meta.dirname, '../index.ts');
const TSX = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;

interface Answer {
  code: number;
  json: Record<string, unknown>;
}

const plitzi = (
  cwd: string,
  args: string[],
  env: Record<string, string> = {},
  { input, json = true }: { input?: string; json?: boolean } = {}
): Promise<Answer> =>
  new Promise(resolve => {
    const child = execFile(
      process.execPath,
      ['--import', TSX, CLI, ...args, ...(json ? ['--json'] : [])],
      { cwd, env: { ...process.env, PLITZI_TASK_TOKEN: '', PLITZI_JSON: '', ...env }, timeout: 60_000 },
      (error, stdout) => {
        const last = stdout.trim().split('\n').at(-1) ?? '{}';
        let json: Record<string, unknown> = {};
        try {
          json = JSON.parse(last) as Record<string, unknown>;
        } catch {
          json = { stdout };
        }

        resolve({ code: error && typeof error.code === 'number' ? error.code : 0, json });
      }
    );
    child.stdin?.end(input ?? '');
  });

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
  await bench.writeTeam({
    ...STARTER_TEAM,
    agents: [{ name: 'dev', roles: ['developer'], count: 2 }, ...STARTER_TEAM.agents.slice(1)]
  });
});

/** The run opened, and the lead's token it answered: what every lead's command passes. */
const openRun = async (): Promise<string> => {
  const opened = await plitzi(bench.root, ['run', 'open', await bench.writePlan(benchPlan())]);
  expect(opened.code).toBe(0);

  return String(opened.json.leadToken);
};

afterEach(async () => {
  await bench.cleanup();
});

describe('plitzi run and plitzi task, as processes', () => {
  it('opens a run, hands out a token, refuses a second taker with 10, and completes with the token alone', async () => {
    const plan = await bench.writePlan(benchPlan());

    expect((await plitzi(bench.root, ['run', 'plan', plan])).json).toMatchObject({ runId: 'es-launch' });
    expect((await plitzi(bench.root, ['run', 'open', plan])).code).toBe(0);

    const taken = await plitzi(bench.root, ['task', 'take', 't-about', '--agent', 'dev-1']);
    expect(taken.code).toBe(0);
    const token = String(taken.json.token);
    const work = String(taken.json.work);

    const second = await plitzi(bench.root, ['task', 'take', 't-about', '--agent', 'dev-2']);
    expect(second.code).toBe(REFUSAL_EXIT_CODES.claimed);
    expect(second.json).toMatchObject({ refused: 'claimed', holder: 'dev-1' });

    await writeInCopy(
      work,
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    // From inside its own copy, which has a package.json of its own: the project is still the one it belongs to.
    const completed = await plitzi(work, ['task', 'complete'], { PLITZI_TASK_TOKEN: token });
    expect(completed.code).toBe(0);
    expect(completed.json).toMatchObject({ changed: ['src/space/pages/about.ts'] });
  }, 120_000);

  it('refuses a person’s action from a shell with no terminal with 17, and a stale token with 12', async () => {
    const lead = await openRun();
    const taken = await plitzi(bench.root, ['task', 'take', 't-about', '--agent', 'dev-1']);

    const finish = await plitzi(bench.root, ['run', 'stop', '--force', '--token', lead]);
    expect(finish.code).toBe(REFUSAL_EXIT_CODES['person-only']);

    expect((await plitzi(bench.root, ['task', 'reassign', 't-about', '--token', lead])).code).toBe(0);
    const stale = await plitzi(bench.root, ['task', 'heartbeat'], { PLITZI_TASK_TOKEN: String(taken.json.token) });
    expect(stale.code).toBe(REFUSAL_EXIT_CODES.reassigned);
  }, 120_000);

  it('answers can-write for any hook: 10 with the holder for another task’s file, 0 for a free one', async () => {
    await openRun();
    await plitzi(bench.root, ['task', 'take', 't-home', '--agent', 'dev-1']);

    // A hook says nothing of itself: what it asks, anyone may.
    const held = await plitzi(bench.root, ['run', 'can-write', 'src/space/pages/home/hero.ts']);
    expect(held.code).toBe(REFUSAL_EXIT_CODES.claimed);
    expect(held.json).toMatchObject({ task: 't-home', holder: 'dev-1' });
    expect((await plitzi(bench.root, ['run', 'can-write', 'src/space/pages/about.ts'])).code).toBe(0);
  }, 120_000);

  it('hands a task its files and the shape of the data they import with --files, in one answer', async () => {
    await bench.write(
      'src/space/pages/about.ts',
      `import menu from ${JSON.stringify('../../data/menu.json')} with { type: ${JSON.stringify('json')} };\n\nexport const about = { menu };\n`
    );
    await openRun();
    const taken = await plitzi(bench.root, ['task', 'take', 't-about', '--agent', 'dev-1']);

    const brief = await plitzi(String(taken.json.work), ['task', 'context', '--files'], {}, { json: false });
    const said = String(brief.json.stdout);
    expect(said).toContain('── src/space/pages/about.ts (4 lines)');
    expect(said).toContain('../../data/menu.json');
    expect(said).toContain('── src/data/menu.json, its shape');
  }, 120_000);

  it('knows the task it runs in from its copy, reads a text written - from stdin, and answers JSON for PLITZI_JSON', async () => {
    const lead = await openRun();
    const taken = await plitzi(bench.root, ['task', 'take', 't-about', '--agent', 'dev-1']);
    const work = String(taken.json.work);

    // No token, no run, no agent said: the copy says who it is.
    const context = await plitzi(work, ['task', 'context']);
    expect(context).toMatchObject({ code: 0 });
    expect(context.json).toMatchObject({ task: { id: 't-about' } });

    const told = await plitzi(
      work,
      ['task', 'tell', '-'],
      {},
      { input: 'The "about" page keeps its "id": it is linked.' }
    );
    expect(told.code).toBe(0);
    const inbox = await plitzi(
      bench.root,
      ['task', 'inbox'],
      { PLITZI_JSON: '1', PLITZI_TASK_TOKEN: lead },
      { json: false }
    );
    expect(inbox.json).toMatchObject({
      messages: [{ from: 't-about', text: 'The "about" page keeps its "id": it is linked.' }]
    });

    const asked = await plitzi(work, ['task', 'ask', 'Which title?', '--follow', '--timeout', '2s']);
    expect(asked.json).toMatchObject({ said: expect.stringContaining('no answer yet after 2 s') as unknown });
  }, 120_000);

  it('proves who calls: a name is a token once, never another’s, and a lead’s step is the lead’s', async () => {
    const lead = await openRun();

    // No name, no token, no terminal: no longer the lead — asked who it is.
    const anonymous = await plitzi(bench.root, ['task', 'reassign', 't-about']);
    expect(anonymous.code).toBe(REFUSAL_EXIT_CODES.identity);

    // The lead's name is the lead's token's: said alone, refused.
    const posing = await plitzi(bench.root, ['task', 'message', 't-about', 'hi', '--agent', 'lead']);
    expect(posing.code).toBe(REFUSAL_EXIT_CODES.identity);

    // A newcomer of the team names itself once and is given its token; its name alone is refused after.
    const joined = await plitzi(bench.root, ['task', 'next', '--agent', 'design-1', '--role', 'designer']);
    expect(joined.code).toBe(0);
    const design = (await bench.read('tmp/plitzi-runs/es-launch/scratch/design-1/token'))?.trim() ?? '';
    expect(design).toMatch(/^es-launch\.@design-1\.[0-9a-f]{32}$/);
    expect((await plitzi(bench.root, ['task', 'next', '--agent', 'design-1', '--role', 'designer'])).code).toBe(
      REFUSAL_EXIT_CODES.identity
    );

    // Its token under another's name, a name of no team, a role not its own: each refused.
    const asLead = await plitzi(bench.root, ['task', 'reassign', 't-about', '--token', design, '--agent', 'lead']);
    expect(asLead.code).toBe(REFUSAL_EXIT_CODES.identity);
    expect((await plitzi(bench.root, ['task', 'next', '--agent', 'intruder'])).code).toBe(REFUSAL_EXIT_CODES.identity);
    expect((await plitzi(bench.root, ['task', 'next', '--token', design, '--role', 'developer'])).code).toBe(
      REFUSAL_EXIT_CODES.identity
    );

    // Proved, a designer is still no lead: the lead's steps and its voice stay the lead's.
    const reassign = await plitzi(bench.root, ['task', 'reassign', 't-about', '--token', design]);
    expect(reassign.code).toBe(REFUSAL_EXIT_CODES['lead-only']);
    const message = await plitzi(bench.root, ['task', 'message', 't-about', 'hi', '--token', design]);
    expect(message.code).toBe(REFUSAL_EXIT_CODES['lead-only']);

    // The lead, by its token: its step goes through, and the log says the lead — its token's secret kept out.
    expect((await plitzi(bench.root, ['run', 'note', 'Keep the ids', '--token', lead])).code).toBe(0);
    const log = (await bench.read('tmp/plitzi-runs/es-launch/log.jsonl')) ?? '';
    expect(log).not.toContain(lead.split('.').at(-1) ?? '');
  }, 120_000);

  // velada-polish's dev-1 expected several files and met "too many arguments".
  it('puts several files of a copy back in one discard, and says them', async () => {
    await openRun();
    const taken = await plitzi(bench.root, ['task', 'take', 't-home', '--agent', 'dev-1']);
    const work = String(taken.json.work);
    await writeInCopy(work, 'src/space/pages/home/index.ts', 'export const home = { title: "Tmp" };\n');
    await writeInCopy(work, 'src/space/pages/home/hero.ts', 'export const hero = { title: "Tmp" };\n');

    const discarded = await plitzi(work, [
      'task',
      'discard',
      'src/space/pages/home/index.ts',
      'src/space/pages/home/hero.ts'
    ]);
    expect(discarded.code).toBe(0);
    expect(discarded.json).toMatchObject({ files: ['src/space/pages/home/index.ts', 'src/space/pages/home/hero.ts'] });
  }, 120_000);
});
