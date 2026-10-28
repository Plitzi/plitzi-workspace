import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claudeSessionFile, isRunning, readLaunch } from './launch';
import { launchAgent, launchHarness } from './launchAgent';
import { openRun, readRunLog } from '../run';
import { setTeamAgent } from './team';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { runPaths } from '../core/paths';
import { completeTask, reviewTask } from '../tasks';

import type { Bench } from '../../tests/runProject';

/**
 * The run's keeper and the lead's watch both found design-1 not running and both started it — two sessions on
 * one copy — and test-1 three times: the check that an agent runs and its start were two steps.
 */

let bench: Bench;
let bin = '';
const path0 = process.env.PATH;

beforeEach(async () => {
  bench = await makeBench();
  // A harness that only waits: started for real, as `claude` is, with nothing of a model in it.
  bin = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-fake-claude-'));
  await fs.writeFile(path.join(bin, 'claude'), '#!/bin/sh\nsleep 30\n', { mode: 0o755 });
  process.env.PATH = `${bin}${path.delimiter}${path0 ?? ''}`;
});

afterEach(async () => {
  process.env.PATH = path0;
  for (const agent of ['dev-1']) {
    const record = await fs
      .readFile(path.join(bench.root, 'tmp', 'plitzi-runs', 'es-launch', 'scratch', agent, 'agent.json'), 'utf-8')
      .then(text => JSON.parse(text) as { pid: number })
      .catch(() => undefined);
    if (record) {
      process.kill(record.pid);
    }
  }

  await fs.rm(bin, { recursive: true, force: true });
  await bench.cleanup();
});

describe('starting an agent', () => {
  // A lead asked again to start one that ran was refused — what it asked was so already.
  it('starts it once when two start it at once: the other is told it runs, as an answer', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await openRun(bench.agent('lead'), await bench.writePlan(benchPlan()));

    const both = await Promise.all([
      launchAgent(bench.agent('lead'), 'es-launch', 'dev-1', 'claude'),
      launchAgent(bench.agent('lead'), 'es-launch', 'dev-1', 'claude')
    ]);

    expect(both.filter(each => 'launched' in each)).toHaveLength(1);
    expect(both.find(each => 'running' in each)).toMatchObject({ agent: 'dev-1', running: { harness: 'claude' } });
  });
});

// A run's lead was refused "Which harness: --harness claude | opencode" for one its team.json named.
describe('the harness an agent starts in', () => {
  it('is the one named, else the team’s own launch, else none — the machine’s one alone, or asked', () => {
    expect(launchHarness('opencode', { options: { launch: 'claude' } })).toBe('opencode');
    expect(launchHarness(undefined, { options: { launch: 'claude' } })).toBe('claude');
    expect(launchHarness(undefined, { options: {} })).toBeUndefined();
    expect(launchHarness(undefined, undefined)).toBeUndefined();
  });
});

// Carlos: a scout whose proposal came back was started on an empty context, and read the whole project again.
describe('an agent started again for a task sent back to it', () => {
  const config = process.env.CLAUDE_CONFIG_DIR;

  afterEach(() => {
    if (config === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = config;
    }
  });

  it('reworks it in the session it worked it in: its harness told to resume that one', async () => {
    const steps = runSteps(() => bench);
    process.env.CLAUDE_CONFIG_DIR = path.join(bin, 'claude-home');
    // A harness that says what it was started with, and is done.
    const said = path.join(bin, 'args');
    await fs.writeFile(path.join(bin, 'claude'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${said}'\n`, { mode: 0o755 });
    await steps.open();
    const paths = runPaths(bench.root, 'es-launch');
    const gone = async () => {
      for (let tries = 0; tries < 100; tries += 1) {
        const launch = await readLaunch(paths, 'agent-1');
        if (launch === undefined || !isRunning(launch)) {
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }
    };

    await launchAgent(steps.lead(), 'es-launch', 'agent-1', 'claude');
    const worked = (await readRunLog(paths)).findLast(entry => entry.action === 'launch')?.session;
    expect(typeof worked).toBe('string');
    // Its session as Claude Code keeps it: a context of 30k tokens, under the team's freshContextAt.
    const file = claudeSessionFile(bench.root, String(worked));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      `${JSON.stringify({
        type: 'assistant',
        timestamp: '2020-01-01T00:00:00.000Z',
        message: {
          id: 'm1',
          usage: {
            input_tokens: 10,
            cache_read_input_tokens: 30_000,
            cache_creation_input_tokens: 0,
            output_tokens: 5
          },
          content: []
        }
      })}\n`
    );
    const home = await steps.take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: "Hola" };\n');
    await completeTask(home.ctx, 'es-launch', 't-home');
    await reviewTask(steps.lead(), 'es-launch', 't-home', 'changes', [{ note: 'shorter' }]);
    await gone();

    const again = await launchAgent(steps.lead(), 'es-launch', 'agent-1', 'claude');
    expect(again).toMatchObject({ resumed: worked, rework: 't-home' });
    await gone();
    expect((await fs.readFile(said, 'utf-8')).trim().split('\n').at(-1)).toContain(`--resume ${String(worked)}`);
  });
});
