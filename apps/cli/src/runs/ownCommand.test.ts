import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runOwnCommand } from './ownCommand';
import { openRun } from './run';
import { messageTasks } from './talk';
import { benchPlan, makeBench } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, take } = runSteps(() => bench);

// Scout-1 heard the lead 2.5 min late at probes of its own, scout-3 could not tell whose Playwright held the
// machine, and whole reports read into an agent's context were read again on every turn after.
describe('a command of an agent’s own', () => {
  it('keeps what it printed in a file, says what failed and its end, and brings what the lead said', async () => {
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const home = await take('agent-1', 't-home');
    await messageTasks(lead(), runId, 't-home', 'Narrow it to the hero');
    const printing = `node -e "for (let i = 0; i < 80; i++) console.log('line ' + i); console.log('Error: the hero is missing'); process.exit(3)"`;

    const ran = await runOwnCommand({ ...home.ctx, cwd: home.work }, runId, printing, { task: 't-home' });
    expect(ran).toMatchObject({ code: 3, suite: false, printed: 82 });
    expect(ran.lines.length).toBeLessThan(20);
    expect(ran.lines).toContain('Error: the hero is missing');
    expect(await fs.readFile(ran.log, 'utf-8')).toContain('line 0\n');
    expect(ran.messages.map(message => message.text)).toEqual(['Narrow it to the hero']);
    await fs.rm(path.dirname(ran.log), { recursive: true, force: true });
  });

  it('runs a Playwright suite in its turn on the machine, saying whose it waits for', async () => {
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const home = await take('agent-1', 't-home');
    const lock = path.join(bench.root, 'suite.lock');
    await fs.writeFile(
      lock,
      JSON.stringify({ pid: process.pid, machine: os.hostname(), at: new Date().toISOString() })
    );
    setTimeout(() => void fs.rm(lock, { force: true }), 300);
    const waited: (string | undefined)[] = [];

    const ran = await runOwnCommand({ ...home.ctx, cwd: home.work }, runId, 'echo playwright test', {
      task: 't-home',
      lock,
      onWait: since => waited.push(since)
    });
    expect(ran).toMatchObject({ code: 0, suite: true });
    expect(waited).toHaveLength(1);
    await fs.rm(path.dirname(ran.log), { recursive: true, force: true });
  });
});
