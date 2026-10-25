import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { freePort } from './acceptance';
import { originHere, sayStale } from './copyServer';
import { markPreviewed, stopKept } from './lingering';
import { runPaths, taskPaths } from './paths';
import { startTaskPreview } from './preview';
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

const { open, take, lead } = runSteps(() => bench);

/** The bench served as a project is: `start` answers its `/health` and the page, `start:dev` as the script given. */
const servedBench = async (startDev?: string): Promise<void> => {
  await bench.write(
    'serve.mjs',
    "import http from 'node:http';\n\nhttp.createServer((q, r) => r.end(q.url === '/health' ? '{}' : 'the copy')).listen(process.env.PORT);\n"
  );
  await bench.write(
    'package.json',
    `${JSON.stringify({ name: 'bench', type: 'module', private: true, scripts: { start: 'node serve.mjs', ...(startDev ? { 'start:dev': startDev } : {}) } })}\n`
  );
};

// A run's agents started their copy's server by hand to look at a page — 64 steps across a run, waiting for it,
// asking its port, stopping it — and one `pkill` stopped every copy's server.
describe('originHere', () => {
  // Each `page shot` from a copy started its server and stopped it — hundreds of starts in a run.
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

  // The project's server writes tmp/dev-server.json as it starts, so the server the CLI kept read as the
  // agent's own — reused as it was, "restart it" said — and four of five agents measured code they had changed.
  it('serves anew the server it kept, though that server wrote the record an agent’s own would', async () => {
    await bench.write(
      'serve.mjs',
      [
        "import fs from 'node:fs';",
        "import http from 'node:http';",
        '',
        "const server = http.createServer((q, r) => r.end(q.url === '/health' ? '{}' : 'the copy'));",
        'server.listen(Number(process.env.PORT), () => {',
        "  fs.mkdirSync('tmp', { recursive: true });",
        "  fs.writeFileSync('tmp/dev-server.json', JSON.stringify({ port: Number(process.env.PORT) }));",
        '});',
        ''
      ].join('\n')
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
    await expect
      .poll(() =>
        fs.access(path.join(home.work, 'tmp/dev-server.json')).then(
          () => true,
          () => false
        )
      )
      .toBe(true);
    expect(await origin()).toBe(first);

    await new Promise(resolve => setTimeout(resolve, 20));
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { es: true };\n');
    const second = await origin();
    expect(second).not.toBe(first);
    await stopKept(cache);
  }, 60_000);

  it('asks nothing of a folder that is no task’s copy', async () => {
    expect(await originHere(bench.root, undefined)).not.toHaveProperty('stop');
    expect(descendantsOf(process.pid).length).toBeGreaterThanOrEqual(0);
  });

  // The lead's look served a copy a picture's kept server held — two servers on one copy — and pictured
  // nothing; the before's server stopped too, its output thrown away.
  it('looks at a copy through the server a picture kept, its use marked while it is followed', async () => {
    await servedBench();
    await open();
    const home = await take('agent-1', 't-home');
    const cache = taskPaths(runPaths(bench.root, 'es-launch'), 't-home').cache;
    const kept = await originHere(home.work, undefined);
    if ('problem' in kept) {
      throw new Error(kept.problem);
    }

    const usedAt = async (): Promise<string> =>
      (JSON.parse(await fs.readFile(path.join(cache, 'served.json'), 'utf-8')) as { usedAt: string }).usedAt;
    const before = await usedAt();
    const preview = await startTaskPreview(lead(), 'es-launch', 't-home', await freePort(), { quiet: true });
    try {
      expect(preview).toMatchObject({ url: kept.origin, borrowed: { by: 'kept' } });
      await new Promise(resolve => setTimeout(resolve, 2_300));
      expect(await usedAt()).not.toBe(before);
    } finally {
      preview.stop();
      await stopKept(cache);
    }
  }, 60_000);

  it('says why a look’s server stopped, with what it said last — and forgets the copy was previewed', async () => {
    await servedBench('node -e "console.log(\'cannot start: port taken\'); process.exit(3)"');
    await open();
    await take('agent-1', 't-home');
    const cache = taskPaths(runPaths(bench.root, 'es-launch'), 't-home').cache;
    const preview = await startTaskPreview(lead(), 'es-launch', 't-home', await freePort(), { quiet: true });
    expect(preview.stopped()).toBeUndefined();

    expect((await preview.done).why).toBe('the server stopped (3)');
    expect(preview.stopped()).toEqual({ why: 'the server stopped (3)', said: ['cannot start: port taken'] });
    await new Promise(resolve => setTimeout(resolve, 50));
    await expect(fs.access(path.join(cache, 'previewed.json'))).rejects.toThrow();
  }, 60_000);

  it('pictures a copy a preview serves through it, never a second server beside it', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const cache = taskPaths(runPaths(bench.root, 'es-launch'), 't-home').cache;
    const server = http.createServer((_request, response) => response.end('{}'));
    const port = await freePort();
    await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
    try {
      await markPreviewed(cache, port);
      expect(await originHere(home.work, undefined)).toEqual({ origin: `http://127.0.0.1:${String(port)}` });
      await expect(fs.access(path.join(cache, 'served.json'))).rejects.toThrow();
    } finally {
      server.close();
    }
  });
});

// A run's designer measured an element a refused save added, was told it was "not drawn there", and looked for a `when`.
describe('a save to the space that did not author', () => {
  it('is said with the first line of why, by every command that reads the page — and nothing when it authored', () => {
    const said: string[] = [];
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      said.push(String(chunk));

      return true;
    });
    try {
      sayStale({
        Server: 'shop',
        spaceStale: '\n[author] style-pseudo-content: legend::after\n  at src/space/styles.ts'
      });
      sayStale({ Server: 'shop' });
      sayStale(null);
    } finally {
      write.mockRestore();
    }

    expect(said.map(line => stripVTControlCharacters(line))).toEqual([
      '· the last save to the space did not author: this is the space as it last authored, without that save — [author] style-pseudo-content: legend::after (npm run author says it whole)\n'
    ]);
  });
});
