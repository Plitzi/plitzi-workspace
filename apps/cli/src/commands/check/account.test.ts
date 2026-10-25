import http from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { sessionCookie } from './account';

import type { AddressInfo } from 'node:net';

const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

/** A server whose `/auth/login` signs `dax` in with its password, setting the session cookie. */
const server = async (): Promise<string> => {
  const listening = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      const ok = request.url === '/auth/login' && body === JSON.stringify({ username: 'dax', password: 'right' });
      response.writeHead(
        ok ? 200 : 401,
        ok ? { 'set-cookie': ['session=abc; Path=/; HttpOnly', 'csrf=x; Path=/'] } : {}
      );
      response.end();
    });
  });
  servers.push(listening);
  await new Promise<void>(resolve => listening.listen(0, '127.0.0.1', resolve));

  // Listening on a host and port, address() is an AddressInfo: its type is a union with the string a pipe answers.
  return `http://127.0.0.1:${String((listening.address() as AddressInfo).port)}`;
};

// encore-4: a look signed in found no link to /u/:username — its links were read as a guest's.
describe('a session for reading the site without a browser', () => {
  it('is the cookies the sign-in sets, or why there are none', async () => {
    const origin = await server();

    expect(await sessionCookie(origin, { username: 'dax', password: 'right' })).toBe('session=abc; csrf=x');
    expect(await sessionCookie(origin, { username: 'dax', password: 'wrong' })).toEqual({
      problem: 'dax was not signed in at /auth/login (401)'
    });
  });
});
