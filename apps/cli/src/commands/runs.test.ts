import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REFUSAL_EXIT_CODES } from '../runs/refusal';
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
});

afterEach(async () => {
  await bench.cleanup();
});

describe('plitzi run and plitzi task, as processes', () => {
  it('opens a run, hands out a token, refuses a second taker with 10, and completes with the token alone', async () => {
    const plan = await bench.writePlan(benchPlan());

    expect((await plitzi(bench.root, ['run', 'plan', plan])).json).toMatchObject({ runId: 'es-launch' });
    expect((await plitzi(bench.root, ['run', 'open', plan])).code).toBe(0);

    const taken = await plitzi(bench.root, ['task', 'take', 't-about', '--agent', 'agent-1']);
    expect(taken.code).toBe(0);
    const token = String(taken.json.token);
    const work = String(taken.json.work);

    const second = await plitzi(bench.root, ['task', 'take', 't-about', '--agent', 'agent-2']);
    expect(second.code).toBe(REFUSAL_EXIT_CODES.claimed);
    expect(second.json).toMatchObject({ refused: 'claimed', holder: 'agent-1' });

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
    const plan = await bench.writePlan(benchPlan());
    await plitzi(bench.root, ['run', 'open', plan]);
    const taken = await plitzi(bench.root, ['task', 'take', 't-about']);

    const finish = await plitzi(bench.root, ['run', 'stop', '--force']);
    expect(finish.code).toBe(REFUSAL_EXIT_CODES['person-only']);

    await plitzi(bench.root, ['task', 'reassign', 't-about']);
    const stale = await plitzi(bench.root, ['task', 'heartbeat'], { PLITZI_TASK_TOKEN: String(taken.json.token) });
    expect(stale.code).toBe(REFUSAL_EXIT_CODES.reassigned);
  }, 120_000);

  it('answers can-write for any hook: 10 with the holder for another task’s file, 0 for a free one', async () => {
    await plitzi(bench.root, ['run', 'open', await bench.writePlan(benchPlan())]);
    await plitzi(bench.root, ['task', 'take', 't-home', '--agent', 'agent-1']);

    const held = await plitzi(bench.root, ['run', 'can-write', 'src/space/pages/home/hero.ts']);
    expect(held.code).toBe(REFUSAL_EXIT_CODES.claimed);
    expect(held.json).toMatchObject({ task: 't-home', holder: 'agent-1' });
    expect((await plitzi(bench.root, ['run', 'can-write', 'src/space/pages/about.ts'])).code).toBe(0);
  }, 120_000);

  it('hands a task its files and the shape of the data they import with --files, in one answer', async () => {
    await bench.write(
      'src/space/pages/about.ts',
      `import menu from ${JSON.stringify('../../data/menu.json')} with { type: ${JSON.stringify('json')} };\n\nexport const about = { menu };\n`
    );
    await plitzi(bench.root, ['run', 'open', await bench.writePlan(benchPlan())]);
    const taken = await plitzi(bench.root, ['task', 'take', 't-about', '--agent', 'agent-1']);

    const brief = await plitzi(String(taken.json.work), ['task', 'context', '--files'], {}, { json: false });
    const said = String(brief.json.stdout);
    expect(said).toContain('── src/space/pages/about.ts (4 lines)');
    expect(said).toContain('../../data/menu.json');
    expect(said).toContain('── src/data/menu.json, its shape');
  }, 120_000);

  it('knows the task it runs in from its copy, reads a text written - from stdin, and answers JSON for PLITZI_JSON', async () => {
    await plitzi(bench.root, ['run', 'open', await bench.writePlan(benchPlan())]);
    const taken = await plitzi(bench.root, ['task', 'take', 't-about', '--agent', 'agent-1']);
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
    const inbox = await plitzi(bench.root, ['task', 'inbox'], { PLITZI_JSON: '1' }, { json: false });
    expect(inbox.json).toMatchObject({
      messages: [{ from: 't-about', text: 'The "about" page keeps its "id": it is linked.' }]
    });

    const asked = await plitzi(work, ['task', 'ask', 'Which title?', '--follow', '--timeout', '2s']);
    expect(asked.json).toMatchObject({ said: expect.stringContaining('no answer yet after 2 s') as unknown });
  }, 120_000);
});
