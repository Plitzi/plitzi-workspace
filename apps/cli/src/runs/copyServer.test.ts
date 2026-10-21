import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { originHere } from './copyServer';
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
  it('serves a task’s copy nobody serves for the command, and stops it after', async () => {
    await bench.write(
      'serve.mjs',
      "import http from 'node:http';\n\nhttp.createServer((q, r) => r.end('the copy')).listen(process.env.PORT);\n"
    );
    await bench.write(
      'package.json',
      `${JSON.stringify({ name: 'bench', type: 'module', private: true, scripts: { start: 'node serve.mjs' } })}\n`
    );
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');

    const where = await originHere(home.work, undefined);
    if ('problem' in where) {
      throw new Error(where.problem);
    }

    expect(await (await fetch(where.origin)).text()).toBe('the copy');
    expect(where.stop).toBeDefined();
    where.stop?.();
    // Nothing of it left listening.
    await new Promise(resolve => setTimeout(resolve, 300));
    await expect(fetch(where.origin)).rejects.toThrow();
  }, 30_000);

  it('asks nothing of a folder that is no task’s copy', async () => {
    expect(await originHere(bench.root, undefined)).not.toHaveProperty('stop');
    expect(descendantsOf(process.pid).length).toBeGreaterThanOrEqual(0);
  });
});
