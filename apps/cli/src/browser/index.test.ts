import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { projectOrigin } from './index';

const projectAt = async (recorded?: { port: number; name: string }): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-origin-'));
  if (recorded) {
    await fs.mkdir(path.join(root, 'tmp'));
    await fs.writeFile(path.join(root, 'tmp/dev-server.json'), JSON.stringify(recorded));
  }

  return root;
};

const answering = (body: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

describe('projectOrigin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('is the port npm start took, once what answers there says it is this project', async () => {
    vi.stubGlobal('fetch', answering({ Server: 'shop' }));

    expect(await projectOrigin(await projectAt({ port: 8081, name: 'shop' }), undefined)).toEqual({
      origin: 'http://127.0.0.1:8081'
    });
  });

  it('refuses a port another server answers on', async () => {
    vi.stubGlobal('fetch', answering({ Server: 'blog' }));

    expect(await projectOrigin(await projectAt({ port: 8081, name: 'shop' }), undefined)).toEqual({
      problem: 'Port 8081 answers as "blog", not this project ("shop"). Start it: npm start'
    });
  });

  // Vite has no /health: a project that recorded no name is not asked one.
  it('asks nothing of a dev server that never named itself, and takes PORT when it is set', async () => {
    const fetched = answering({});
    vi.stubGlobal('fetch', fetched);
    vi.stubEnv('PORT', '5180');

    expect(await projectOrigin(await projectAt(), { kind: 'project', mode: 'client', source: 'local' })).toEqual({
      origin: 'http://127.0.0.1:5180'
    });
    expect(fetched).not.toHaveBeenCalled();
  });
});
