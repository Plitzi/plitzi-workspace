import { createServer } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { ftpUploader, passiveAddress } from './ftp';

import type { Server, Socket } from 'node:net';

/** An FTP host on this machine that answers as one does, without TLS, and keeps what it is sent. */

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

const listen = (server: Server): Promise<number> =>
  new Promise(resolve => {
    servers.push(server);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });

const fakeHost = async () => {
  const stored = new Map<string, string>();
  const commands: string[] = [];
  let pending: { path: string; data: Socket | undefined; chunks: Buffer[]; control: Socket } | undefined;
  const dataServer = createServer(socket => {
    if (pending) {
      pending.data = socket;
    }

    socket.on('data', (chunk: Buffer) => pending?.chunks.push(chunk));
    socket.on('end', () => {
      if (pending) {
        stored.set(pending.path, Buffer.concat(pending.chunks).toString());
        pending.control.write('226 Transfer complete\r\n');
        pending = undefined;
      }
    });
  });
  const dataPort = await listen(dataServer);
  const control = createServer(socket => {
    socket.write('220-Welcome\r\n220 Ready\r\n');
    socket.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\r\n').filter(Boolean)) {
        commands.push(line);
        const [verb, ...rest] = line.split(' ');
        const argument = rest.join(' ');
        if (verb === 'USER') {
          socket.write('331 Password\r\n');
        } else if (verb === 'PASS') {
          socket.write(argument === 'secret' ? '230 In\r\n' : '530 Login incorrect\r\n');
        } else if (verb === 'TYPE') {
          socket.write('200 Binary\r\n');
        } else if (verb === 'MKD') {
          socket.write('257 Made\r\n');
        } else if (verb === 'PASV') {
          socket.write(`227 Entering Passive Mode (127,0,0,1,${String(dataPort >> 8)},${String(dataPort & 255)})\r\n`);
        } else if (verb === 'STOR') {
          pending = { path: argument, data: undefined, chunks: [], control: socket };
          socket.write('150 Go\r\n');
        } else if (verb === 'QUIT') {
          socket.end('221 Bye\r\n');
        } else {
          socket.write('502 No\r\n');
        }
      }
    });
  });

  return { port: await listen(control), stored, commands };
};

const files = [
  { path: 'index.html', body: new TextEncoder().encode('<p>hi</p>'), type: 'text/html', cache: 'revalidate' as const },
  {
    path: '_plitzi/sdk-1/a.js',
    body: new TextEncoder().encode('a()'),
    type: 'text/javascript',
    cache: 'immutable' as const
  }
];

describe('a site written by FTP', () => {
  it('stores every file in its folder, making the folders it needs, and says it is not atomic', async () => {
    const host = await fakeHost();
    const log: string[] = [];
    const result = await ftpUploader({
      host: '127.0.0.1',
      port: host.port,
      user: 'ana',
      password: 'secret',
      secure: 'none',
      folder: 'public_html'
    }).upload(files, line => log.push(line));

    expect(Object.fromEntries(host.stored)).toEqual({
      'public_html/index.html': '<p>hi</p>',
      'public_html/_plitzi/sdk-1/a.js': 'a()'
    });
    expect(host.commands).toContain('MKD public_html/_plitzi/sdk-1');
    expect(result).toMatchObject({ files: 2, reference: 'public_html' });
    expect(log.join('\n')).toMatch(/one by one/);
    expect(log.join('\n')).toMatch(/in the clear/);
  });

  it('says the host’s own words when it refuses the password', async () => {
    const host = await fakeHost();

    await expect(
      ftpUploader({ host: '127.0.0.1', port: host.port, user: 'ana', password: 'wrong', secure: 'none' }).upload(
        files,
        () => undefined
      )
    ).rejects.toThrow('The FTP host refused the password: 530 Login incorrect');
  });

  it('reads the data address of a passive answer', () => {
    expect(passiveAddress('227 Entering Passive Mode (192,168,1,9,19,137)')).toEqual({
      host: '192.168.1.9',
      port: 5001
    });
  });
});
