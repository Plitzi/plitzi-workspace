import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkAcceptance, serveCopy } from './acceptance';

/**
 * The acceptance's server was asked for :61515, found it taken — agents checking at once — and took :62189, as
 * a server while developing does; the check waited on :61515 for a minute and failed a task that was right.
 */

const folders: string[] = [];

afterEach(async () => {
  for (const folder of folders.splice(0)) {
    await fs.rm(folder, { recursive: true, force: true });
  }
});

/** A copy whose server takes a port of its own, whatever it is asked, and says it where a project's server does. */
const copyMovingPort = async (): Promise<string> => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-moving-port-'));
  folders.push(work);
  await fs.writeFile(
    path.join(work, 'server.mjs'),
    [
      "import fs from 'node:fs';",
      "import http from 'node:http';",
      "import path from 'node:path';",
      "const server = http.createServer((_, response) => response.end('ok'));",
      "server.listen(0, '127.0.0.1', () => {",
      '  const file = path.join(process.cwd(), process.env.PLITZI_SERVER_RECORD);',
      '  fs.mkdirSync(path.dirname(file), { recursive: true });',
      '  fs.writeFileSync(file, JSON.stringify({ port: server.address().port }));',
      '});',
      ''
    ].join('\n')
  );
  await fs.writeFile(path.join(work, 'package.json'), JSON.stringify({ scripts: { start: 'node server.mjs' } }));

  return work;
};

describe("the copy's server for an acceptance", () => {
  it('is reached where it says it listens, not where it was asked to', async () => {
    const work = await copyMovingPort();
    const cache = path.join(work, 'cache');
    await fs.mkdir(cache);

    const served = await serveCopy(work, work, cache);
    try {
      expect(served).not.toHaveProperty('problem');
      if ('url' in served) {
        const said = JSON.parse(
          await fs.readFile(path.join(work, 'tmp', 'plitzi-cache', 'acceptance-server.json'), 'utf-8')
        ) as { port: number };
        expect(served.port).toBe(said.port);
        expect(await (await fetch(served.url)).text()).toBe('ok');
      }
    } finally {
      if ('stop' in served) {
        served.stop();
      }
    }
  }, 30_000);
});

// A run's copy imported `node:crypto` into its functions: its server stopped on the build's error, the check waited out
// a minute, and every line was said unanswerable — "amend the line" — when the copy's own code had failed.
describe('a copy whose server stops on an error', () => {
  it('is said at once, as the copy’s own — its lines failed by the work, never unanswerable', async () => {
    const work = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-broken-copy-'));
    folders.push(work);
    await fs.writeFile(
      path.join(work, 'server.mjs'),
      'throw new Error(\'rooms.ts:1 "node:crypto" cannot be imported: functions import their own files\');\n'
    );
    await fs.writeFile(path.join(work, 'package.json'), JSON.stringify({ scripts: { start: 'node server.mjs' } }));
    await fs.mkdir(path.join(work, 'cache'));

    const started = Date.now();
    const results = await checkAcceptance(
      [{ said: 'The page reads', check: 'plitzi page check / --url $PLITZI_URL' }],
      {
        work,
        root: work,
        cache: path.join(work, 'cache')
      }
    );

    expect(Date.now() - started).toBeLessThan(20_000);
    expect(results[0]).toMatchObject({ ok: false });
    expect(results[0]).not.toHaveProperty('unanswered');
    expect(results[0]?.output?.[0]).toMatch(/stopped on an error before it answered .* the copy's own code/);
  }, 30_000);
});
