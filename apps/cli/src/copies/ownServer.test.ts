import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { projectMark } from '@plitzi/sdk-shared/project';

import { ownServer } from './acceptance';

const servers: http.Server[] = [];

const serve = async (instance: string): Promise<number> => {
  const server = http.createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ Server: 'acme', Instance: instance }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();

  return typeof address === 'object' && address !== null ? address.port : 0;
};

const copyRecording = async (port: number): Promise<string> => {
  const work = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-own-server-')));
  await fs.mkdir(path.join(work, 'tmp'));
  await fs.writeFile(path.join(work, 'tmp/dev-server.json'), JSON.stringify({ name: 'acme', port }));

  return work;
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

// A record its dead server left names a port another copy's server holds now: complete refused it as the copy's own.
describe('a server of the copy’s own', () => {
  it('is the one its record names only when it answers with the copy’s folder', async () => {
    const elsewhere = await serve(projectMark(os.tmpdir()));
    expect(await ownServer(await copyRecording(elsewhere))).toBeUndefined();

    const work = await copyRecording(0);
    const own = await serve(projectMark(work));
    await fs.writeFile(path.join(work, 'tmp/dev-server.json'), JSON.stringify({ name: 'acme', port: own }));
    expect(await ownServer(work)).toBe(own);
  });
});
