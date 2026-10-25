import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { serveCopy } from './acceptance';

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
