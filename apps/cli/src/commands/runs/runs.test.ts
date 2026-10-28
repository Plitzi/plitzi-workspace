import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { STARTER_TEAM } from '../../runs/agents/team';
import { REFUSAL_EXIT_CODES } from '../../runs/core/refusal';
import { SRC_ROOT } from '../../tests/roots';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';

import type { Bench } from '../../tests/runProject';

/**
 * The run's commands as a harness meets them: the CLI itself, one process per command, each answering JSON and leaving
 * the exit code its refusal names — so a harness that reads no output still knows what to do.
 */

const CLI = path.join(SRC_ROOT, 'index.ts');
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
      { cwd, env: { ...process.env, PLITZI_TOKEN: '', PLITZI_AGENT: '', PLITZI_JSON: '', ...env }, timeout: 60_000 },
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

/** An agent's token, as its first command kept it: what each of its commands after passes. */
const tokenOf = async (agent: string): Promise<string> =>
  (await bench.read(`tmp/plitzi-runs/es-launch/scratch/${agent}/token`))?.trim() ?? '';

/** The run opened, and the lead's token it answered: what every lead's command passes. */
const openRun = async (): Promise<string> => {
  const opened = await plitzi(bench.root, ['run', 'open', await bench.writePlan(benchPlan())]);
  expect(opened.code).toBe(0);

  return String(opened.json.leadToken);
};

afterEach(async () => {
  await bench.cleanup();
});

/** What it was like, said at every complete: these tests are about who calls, not about the experience. */
const SAID = ['--ease', '4', '--hardest', 'Nothing in particular'];

describe('plitzi run and plitzi task, as processes', () => {
  it('opens a run, hands out a token, refuses a second taker with 10, and completes in the copy with its own token', async () => {
    const plan = await bench.writePlan(benchPlan());

    expect((await plitzi(bench.root, ['run', 'open', plan, '--dry-run'])).json).toMatchObject({ runId: 'es-launch' });
    expect((await plitzi(bench.root, ['run', 'open', plan])).code).toBe(0);

    const taken = await plitzi(bench.root, ['task', 'next', 't-about', '--agent', 'dev-1']);
    expect(taken.code).toBe(0);
    const work = String(taken.json.work);
    // Its brief with it: every agent asked for it next, a turn a task.
    expect(taken.json.brief).toMatchObject({ task: { id: 't-about' } });

    const second = await plitzi(bench.root, ['task', 'next', 't-about', '--agent', 'dev-2']);
    expect(second.code).toBe(REFUSAL_EXIT_CODES.claimed);
    expect(second.json).toMatchObject({ refused: 'claimed', holder: 'dev-1' });

    await writeInCopy(
      work,
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    // From inside its own copy, which has a package.json of its own: the project is still the one it belongs to.
    const completed = await plitzi(work, ['task', 'complete', ...SAID], { PLITZI_TOKEN: await tokenOf('dev-1') });
    expect(completed.code).toBe(0);
    expect(completed.json).toMatchObject({ changed: ['src/space/pages/about.ts'] });
    // Its piece ended, it is told it stops by the answer itself — not by a `task next` asked only for that.
    expect(String(completed.json.stop)).toContain('t-about is complete');
    // A tester handed its review with what went to it: every reviewer asked `task show` next.
    const review = await plitzi(bench.root, ['task', 'next', '--agent', 'test-1', '--no-wait']);
    expect(review.json).toMatchObject({ review: { task: { id: 't-about' } }, shown: { task: { id: 't-about' } } });
  }, 120_000);

  it('refuses a person’s action from a shell with no terminal with 17, and a stale token with 12', async () => {
    const lead = await openRun();
    const taken = await plitzi(bench.root, ['task', 'next', 't-about', '--agent', 'dev-1']);

    const finish = await plitzi(bench.root, ['run', 'stop', '--force', '--token', lead]);
    expect(finish.code).toBe(REFUSAL_EXIT_CODES['person-only']);

    expect((await plitzi(bench.root, ['task', 'reassign', 't-about', '--token', lead])).code).toBe(0);
    const stale = await plitzi(String(taken.json.work), ['task', 'progress', '--token', await tokenOf('dev-1')]);
    expect(stale.code).toBe(REFUSAL_EXIT_CODES.reassigned);
  }, 120_000);

  // Two runs' agents wrote `task next --follow --take` 130 times in 138, the lead `run watch --until lead` 83 in 83: what
  // was always said is what the command does, and each list is its command with nothing named.
  it('takes and waits by itself, watches for the lead as the lead, and lists with nothing named', async () => {
    const lead = await openRun();

    const peeked = await plitzi(bench.root, ['task', 'next', '--agent', 'dev-1', '--peek']);
    expect(peeked.code).toBe(0);
    expect(peeked.json).not.toHaveProperty('taken');
    const taken = await plitzi(bench.root, ['task', 'next', '--token', await tokenOf('dev-1'), '--no-wait']);
    expect(taken.code).toBe(0);
    expect(taken.json).toMatchObject({ taken: { task: { id: 't-home' } } });

    const watched = await plitzi(bench.root, ['run', 'watch', '--token', lead, '--timeout', '1s']);
    expect(watched.code).toBe(0);
    expect(watched.json).toMatchObject({ status: 'open' });

    expect((await plitzi(bench.root, ['task', 'claim', '--token', lead])).code).toBe(0);
    // A file's turn is one command: waited for and let go by `task claim`, each refused as it cannot be done.
    const both = await plitzi(bench.root, ['task', 'claim', 'src/a.ts', '--wait', '--release', '--token', lead]);
    expect(both.code).toBe(REFUSAL_EXIT_CODES.invalid);
    const unnamed = await plitzi(bench.root, ['task', 'claim', '--wait', '--token', lead]);
    expect(unnamed.json).toMatchObject({
      message: expect.stringContaining('plitzi task claim <file> --wait') as unknown
    });
    expect((await plitzi(bench.root, ['task', 'propose', '--token', lead])).code).toBe(0);
    const unsaid = await plitzi(bench.root, ['task', 'propose', 't-menu', '--token', await tokenOf('dev-1')]);
    expect(unsaid.code).toBe(REFUSAL_EXIT_CODES.invalid);
    expect(unsaid.json).toMatchObject({ next: 'plitzi task propose t-menu --change "the card takes a `lang` prop"' });
    expect((await plitzi(bench.root, ['run', 'report', '--plitzi', '--token', lead])).code).toBe(0);
    expect((await plitzi(bench.root, ['run', 'status', '--all'])).json).toMatchObject({
      runs: [{ runId: 'es-launch', ready: false, apply: 'npx plitzi run finish es-launch --apply' }]
    });

    // A lead never grants itself the project's finish: a person's, as `run open --lead-finishes` is.
    const granted = await plitzi(bench.root, ['run', 'finish', '--lead-finishes', '--token', lead]);
    expect(granted.code).toBe(REFUSAL_EXIT_CODES['person-only']);
  }, 120_000);

  it('answers can-write for any hook: 10 with the holder for another task’s file, 0 for a free one', async () => {
    await openRun();
    await plitzi(bench.root, ['task', 'next', 't-home', '--agent', 'dev-1']);

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
    const taken = await plitzi(bench.root, ['task', 'next', 't-about', '--agent', 'dev-1']);

    const brief = await plitzi(
      String(taken.json.work),
      ['task', 'context', '--files', '--token', await tokenOf('dev-1')],
      {},
      { json: false }
    );
    const said = String(brief.json.stdout);
    expect(said).toContain('── src/space/pages/about.ts (4 lines)');
    expect(said).toContain('../../data/menu.json');
    expect(said).toContain('── src/data/menu.json, its shape');
  }, 120_000);

  it('knows the task it runs in from its copy, reads a text written - from stdin, and answers JSON for PLITZI_JSON', async () => {
    const lead = await openRun();
    const taken = await plitzi(bench.root, ['task', 'next', 't-about', '--agent', 'dev-1']);
    const work = String(taken.json.work);
    const dev = { PLITZI_TOKEN: await tokenOf('dev-1') };

    // Its token says who; the copy says which task — no task, no run said.
    const context = await plitzi(work, ['task', 'context'], dev);
    expect(context).toMatchObject({ code: 0 });
    expect(context.json).toMatchObject({ task: { id: 't-about' } });

    const told = await plitzi(work, ['task', 'tell', '-'], dev, {
      input: 'The "about" page keeps its "id": it is linked.'
    });
    expect(told.code).toBe(0);
    const inbox = await plitzi(
      bench.root,
      ['task', 'inbox'],
      { PLITZI_JSON: '1', PLITZI_TOKEN: lead },
      { json: false }
    );
    expect(inbox.json).toMatchObject({
      messages: [{ from: 't-about', text: 'The "about" page keeps its "id": it is linked.' }]
    });

    const asked = await plitzi(work, ['task', 'tell', 'Which title?', '--ask', '--follow', '--timeout', '2s'], dev);
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
    const joined = await plitzi(bench.root, ['task', 'next', '--agent', 'design-1', '--role', 'designer', '--peek']);
    expect(joined.code).toBe(0);
    const design = (await bench.read('tmp/plitzi-runs/es-launch/scratch/design-1/token'))?.trim() ?? '';
    expect(design).toMatch(/^es-launch\.@design-1\.[0-9a-f]{32}$/);
    expect(
      (await plitzi(bench.root, ['task', 'next', '--agent', 'design-1', '--role', 'designer', '--peek'])).code
    ).toBe(REFUSAL_EXIT_CODES.identity);

    // Its token under another's name, a name of no team, a role not its own: each refused.
    const asLead = await plitzi(bench.root, ['task', 'reassign', 't-about', '--token', design, '--agent', 'lead']);
    expect(asLead.code).toBe(REFUSAL_EXIT_CODES.identity);
    expect((await plitzi(bench.root, ['task', 'next', '--agent', 'intruder', '--peek'])).code).toBe(
      REFUSAL_EXIT_CODES.identity
    );
    expect((await plitzi(bench.root, ['task', 'next', '--token', design, '--role', 'developer', '--peek'])).code).toBe(
      REFUSAL_EXIT_CODES.identity
    );

    // Proved, a designer is still no lead: the lead's steps and its voice stay the lead's.
    const reassign = await plitzi(bench.root, ['task', 'reassign', 't-about', '--token', design]);
    expect(reassign.code).toBe(REFUSAL_EXIT_CODES['lead-only']);
    const message = await plitzi(bench.root, ['task', 'message', 't-about', 'hi', '--token', design]);
    expect(message.code).toBe(REFUSAL_EXIT_CODES['lead-only']);

    // The lead, by its token: its step goes through, and the log says the lead — its token's secret kept out.
    expect((await plitzi(bench.root, ['task', 'message', 'all', 'Keep the ids', '--token', lead])).code).toBe(0);
    const log = (await bench.read('tmp/plitzi-runs/es-launch/log.jsonl')) ?? '';
    expect(log).not.toContain(lead.split('.').at(-1) ?? '');
  }, 120_000);

  // `--token "$(cat …)"` read from the wrong folder came in empty and ran as "agent" — it joined, took a
  // task, and the rework sent back to "agent" sat with no one. No token, an empty one, a task's: who calls is unproved.
  it('refuses every caller its own token does not prove — in a task’s copy too — and never makes up a name', async () => {
    await openRun();
    const taken = await plitzi(bench.root, ['task', 'next', 't-about', '--agent', 'dev-1']);
    const work = String(taken.json.work);
    await plitzi(bench.root, ['task', 'next', '--agent', 'dev-2', '--role', 'developer', '--peek']);

    for (const [cwd, args, env] of [
      [work, ['task', 'context'], {}],
      [work, ['task', 'complete', ...SAID, '--token', ''], {}],
      [bench.root, ['task', 'next', '--no-wait', '--role', 'developer', '--token', ''], {}],
      [work, ['task', 'progress', '--token', String(taken.json.token)], {}],
      [bench.root, ['task', 'next', '--no-wait', '--role', 'developer', '--token', 'not-a-token'], {}]
    ] as const) {
      expect((await plitzi(cwd, [...args], env)).code).toBe(REFUSAL_EXIT_CODES.identity);
    }

    // Another agent's token in dev-1's copy is not given dev-1's task.
    const foreign = await plitzi(work, ['task', 'complete', ...SAID, '--token', await tokenOf('dev-2')]);
    expect(foreign.code).not.toBe(0);
    expect(await bench.read('tmp/plitzi-runs/es-launch/scratch/agent/token')).toBeUndefined();
    const log = (await bench.read('tmp/plitzi-runs/es-launch/log.jsonl')) ?? '';
    expect(log).not.toContain('"by":"agent"');
  }, 120_000);

  // Closing an item once its run had finished crashed — the caller read before any run proved it.
  it('closes a backlog item with no run open, saying who it can: unnamed off a terminal', async () => {
    await bench.write(
      '.plitzi/backlog.json',
      JSON.stringify({
        version: 1,
        items: [{ id: 'b-1', text: 'A CLI defect', from: 'shop-fidelity', by: 'lead', at: '2026-10-22T15:00:00.000Z' }]
      })
    );

    const closed = await plitzi(bench.root, ['run', 'backlog', 'done', 'b-1', '--note', 'the CLI’s']);
    expect(closed.code).toBe(0);
    expect(closed.json).toMatchObject({ closed: { id: 'b-1', done: { by: 'unnamed', note: 'the CLI’s' } } });
  }, 120_000);

  // `run backlog add` and `run notice` both kept an item for later: one command keeps it, with a run open or none.
  it('keeps what is noticed with no run open in the backlog at once — and refuses one of Plitzi, which is a report', async () => {
    const kept = await plitzi(bench.root, ['run', 'notice', 'The map has no legend', '--on', '/book']);
    expect(kept.code).toBe(0);
    expect(kept.json).toMatchObject({ kept: { id: 'b-1', text: 'The map has no legend', on: '/book' } });

    const ofPlitzi = await plitzi(bench.root, ['run', 'notice', 'The CLI crashed', '--plitzi']);
    expect(ofPlitzi.code).toBe(REFUSAL_EXIT_CODES.invalid);
  }, 120_000);

  // A scout's stage, its tasks alone as its skill shows one, was refused by run open --dry-run as "not a plan".
  it('sees a stage of tasks alone on the open run with run open --dry-run, stacking nothing', async () => {
    await openRun();
    await bench.write(
      'stage.json',
      JSON.stringify({
        tasks: [
          {
            id: 't-contact',
            title: 'A contact page',
            files: ['src/space/pages/contact.ts'],
            dependsOn: [],
            priority: 'medium',
            estimateMinutes: 10,
            acceptance: [{ said: 'There is a contact page', check: 'test -f src/space/pages/contact.ts' }]
          }
        ]
      })
    );

    const seen = await plitzi(bench.root, ['run', 'open', 'stage.json', '--dry-run', '--lines']);
    expect(seen.code).toBe(0);
    expect(seen.json).toMatchObject({ stackedOn: 'es-launch', tasks: [{ id: 't-contact' }] });

    // Refused, it is said as a stage — the fields it may leave out never asked of it.
    await bench.write('bad.json', JSON.stringify({ leftOut: 'b-38', tasks: [] }));
    const refused = await plitzi(bench.root, ['run', 'open', 'bad.json', '--dry-run']);
    expect(refused.code).toBe(REFUSAL_EXIT_CODES.invalid);
    const { message } = refused.json;
    expect(message).toContain('is not a stage — { tasks: [');
    expect(message).toContain('leftOut: lines of what the run does not do');
    expect(message).not.toContain('version: 1, runId');
  }, 120_000);

  // A run's dev-1 expected several files and met "too many arguments".
  it('puts several files of a copy back in one discard, and says them', async () => {
    await openRun();
    const taken = await plitzi(bench.root, ['task', 'next', 't-home', '--agent', 'dev-1']);
    const work = String(taken.json.work);
    await writeInCopy(work, 'src/space/pages/home/index.ts', 'export const home = { title: "Tmp" };\n');
    await writeInCopy(work, 'src/space/pages/home/hero.ts', 'export const hero = { title: "Tmp" };\n');

    const discarded = await plitzi(
      work,
      ['task', 'discard', 'src/space/pages/home/index.ts', 'src/space/pages/home/hero.ts'],
      { PLITZI_TOKEN: await tokenOf('dev-1') }
    );
    expect(discarded.code).toBe(0);
    expect(discarded.json).toMatchObject({ files: ['src/space/pages/home/index.ts', 'src/space/pages/home/hero.ts'] });
  }, 120_000);

  // A run's dev-2 was refused its own task's diff: what it did is its own to read; another's is the lead's.
  it('shows a task to its holder from its copy, and refuses another task to it', async () => {
    await openRun();
    const taken = await plitzi(bench.root, ['task', 'next', 't-home', '--agent', 'dev-1']);
    const work = String(taken.json.work);

    const dev = { PLITZI_TOKEN: await tokenOf('dev-1') };
    expect((await plitzi(work, ['task', 'show', 't-home'], dev)).code).toBe(0);
    // Another task too, read only: a run's agents were refused it and diffed its blobs by hash to read a request.
    expect((await plitzi(work, ['task', 'show', 't-about'], dev)).code).toBe(0);
  }, 120_000);

  // What each command printed is what its agent read: the run's cost, kept a line a command — secrets out.
  it('keeps what each command of a run printed, by whom — and nothing of a command outside a run', async () => {
    const lead = await openRun();
    const taken = await plitzi(bench.root, ['task', 'next', 't-about', '--agent', 'dev-1']);
    const dev = await tokenOf('dev-1');
    await plitzi(String(taken.json.work), ['task', 'context', '--token', dev]);
    await plitzi(bench.root, ['run', 'status', '--token', lead]);
    // A command that is no run's — a page measured — counted as the agent its token proves; a forged one is not it.
    await plitzi(bench.root, ['page', 'measure', '--help', '--token', dev], {}, { json: false });
    const forged = dev.replace(/.$/, last => (last === '0' ? '1' : '0'));
    await plitzi(bench.root, ['page', 'shot', '--help', '--token', forged], {}, { json: false });

    const usage = ((await bench.read('tmp/plitzi-runs/es-launch/usage.jsonl')) ?? '')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as { by: string; command: string; chars: number });
    expect(usage.map(line => [line.by, line.command.split(' ').slice(1, 3).join(' ')])).toEqual(
      expect.arrayContaining([
        ['lead', 'run open'],
        ['dev-1', 'task next'],
        ['dev-1', 'task context'],
        ['lead', 'run status'],
        ['dev-1', 'page measure'],
        ['unnamed', 'page shot']
      ])
    );
    expect(usage.every(line => line.chars > 0)).toBe(true);
    expect(usage.map(line => line.command).join(' ')).not.toContain(lead.split('.').at(-1) ?? '');
  }, 120_000);

  // A run's lead read 12k characters of the overview: every unit spelled out each shared file it reaches.
  it('says each unit in a line, counted, and one unit whole when it is named', async () => {
    const whole = await plitzi(bench.root, ['space', 'overview']);
    const units = whole.json.units as { unit: string; owns: string[] }[];
    const first = units.at(0);
    expect(whole.code).toBe(0);
    if (!first) {
      throw new Error('The project has no unit to name');
    }

    const one = await plitzi(bench.root, ['space', 'overview', first.unit]);
    expect(one.code).toBe(0);
    expect(one.json).toMatchObject({ unit: first.unit, owns: first.owns });

    const text = await plitzi(bench.root, ['space', 'overview'], {}, { json: false });
    expect(String(text.json.stdout)).toContain(`${first.unit}: owns ${String(first.owns.length)}`);
    expect(String(text.json.stdout)).not.toMatch(/shares src\//);

    const unknown = await plitzi(bench.root, ['space', 'overview', 'src/nowhere.ts']);
    expect(unknown.code).toBe(REFUSAL_EXIT_CODES.invalid);
    expect(String(unknown.json.message)).toContain('is no unit of the project');
  }, 120_000);
});
