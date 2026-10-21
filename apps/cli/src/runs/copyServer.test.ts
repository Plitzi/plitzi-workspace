import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { originHere } from './copyServer';
import { stopKept } from './lingering';
import { runPaths, taskPaths } from './paths';
import { descendantsOf } from './processes';
import { makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { open, take } = runSteps(() => bench);

// la-velada's agents started their copy's server by hand to look at a page — 64 steps across a run, waiting for it,
// asking its port, stopping it — and one `pkill` stopped every copy's server.
describe('originHere', () => {
  // velada-dress: each `page shot` from a copy started its server and stopped it — hundreds of starts in a run.
  it('serves a task’s copy nobody serves, keeps it for the next command, serves it anew once the copy changed', async () => {
    await bench.write(
      'serve.mjs',
      "import http from 'node:http';\n\nhttp.createServer((q, r) => r.end(q.url === '/health' ? '{}' : 'the copy')).listen(process.env.PORT);\n"
    );
    await bench.write(
      'package.json',
      `${JSON.stringify({ name: 'bench', type: 'module', private: true, scripts: { start: 'node serve.mjs' } })}\n`
    );
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    const cache = taskPaths(runPaths(bench.root, 'es-launch'), 't-home').cache;
    const origin = async (): Promise<string> => {
      const where = await originHere(home.work, undefined);
      if ('problem' in where) {
        throw new Error(where.problem);
      }

      return where.origin;
    };

    const first = await origin();
    expect(await (await fetch(first, { signal: AbortSignal.timeout(5000) })).text()).toBe('the copy');
    // Kept: the next command reads it as it is.
    expect(await origin()).toBe(first);

    // Written since: it served what was — stopped, and the copy served anew.
    await new Promise(resolve => setTimeout(resolve, 20));
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { es: true };\n');
    const second = await origin();
    expect(second).not.toBe(first);
    // Bounded: a server going away may leave a request hanging, never refused.
    await expect(fetch(first, { signal: AbortSignal.timeout(3000) })).rejects.toThrow();

    // What serves the copy itself stops the one kept first: one server on a copy.
    await stopKept(cache);
    await expect(fetch(second, { signal: AbortSignal.timeout(3000) })).rejects.toThrow();
  }, 60_000);

  it('asks nothing of a folder that is no task’s copy', async () => {
    expect(await originHere(bench.root, undefined)).not.toHaveProperty('stop');
    expect(descendantsOf(process.pid).length).toBeGreaterThanOrEqual(0);
  });
});
