import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { configDir, readConnection, resolveApi, writeConnection } from './connection';
import { fakePlatform } from './fakePlatform';
import { authorizedRequest, connect, currentConnection, disconnect } from './session';

import type { FakePlatform } from './fakePlatform';

/**
 * The CLI's one connection: made in the browser, kept, renewed on its own, and ended when the platform says so — and
 * never more than one, so a command always acts on the space `plitzi whoami` names.
 */

let platform: FakePlatform;
let home: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-cli-'));
  process.env.XDG_CONFIG_HOME = home;
  platform = await fakePlatform();
});

afterEach(async () => {
  await platform.close();
  delete process.env.XDG_CONFIG_HOME;
  await fs.rm(home, { recursive: true, force: true });
});

const signedIn = async (scope?: string) => {
  const connected = await connect(platform.api, { scope, open: platform.browser });
  if (!connected.ok) {
    throw new Error(connected.error);
  }

  return connected.value;
};

describe('signing in', () => {
  it('keeps the session for the account, readable by the person alone', async () => {
    const connection = await signedIn();

    expect(platform.scopes).toEqual(['']);
    expect(connection).toMatchObject({ api: platform.api, grant: { target: 'account' } });
    expect(connection.space).toBeUndefined();
    expect(await readConnection()).toEqual(connection);
    const { mode } = await fs.stat(path.join(configDir(), 'connection.json'));
    expect(mode & 0o777).toBe(0o600);
  });

  it('works in the space chosen on the grant screen, named as the platform names it', async () => {
    const connection = await signedIn('space');

    expect(platform.scopes).toEqual(['space']);
    expect(connection.space).toEqual({ id: 3, name: 'Website', permanentUrl: 'website' });
  });

  /** One connection: choosing a space again, or signing in again, replaces it and revokes what it replaced. */
  it('replaces the connection it had, and revokes it rather than leave it alive', async () => {
    const first = await signedIn('space');
    const second = await signedIn();

    expect(platform.revoked).toEqual([first.grant.refreshToken]);
    expect(await readConnection()).toEqual(second);
  });

  it('forgets nothing it did not make when the sign-in does not complete', async () => {
    const before = await signedIn();
    platform.choose = 'space:999';

    const failed = await connect(platform.api, { scope: 'space', open: platform.browser });

    expect(failed.ok).toBe(false);
    expect(await readConnection()).toEqual(before);
  });
});

describe('keeping it', () => {
  it('is no connection at all on another platform', async () => {
    await signedIn();

    expect(await currentConnection('https://api.elsewhere.test')).toEqual({ ok: true, value: undefined });
  });

  it('renews a session about to expire, before using it', async () => {
    platform.expiresIn = 30;
    const connection = await signedIn();

    const current = await currentConnection(platform.api);

    expect(current.ok && current.value?.grant.accessToken).not.toBe(connection.grant.accessToken);
    expect((await readConnection())?.grant.accessToken).toBe(current.ok && current.value?.grant.accessToken);
  });

  it('ends the connection when the platform refuses to renew it, and says what to run', async () => {
    platform.expiresIn = 30;
    await signedIn('space');
    platform.renewable.clear();

    const current = await currentConnection(platform.api);

    expect(current).toEqual({ ok: false, error: expect.stringContaining('plitzi space') as string });
    expect(await readConnection()).toBeUndefined();
  });

  it('keeps it when the platform cannot be reached: a laptop off the network signs nobody out', async () => {
    platform.expiresIn = 30;
    const connection = await signedIn();
    await platform.close();

    const current = await currentConnection(platform.api);

    expect(current.ok).toBe(false);
    expect(await readConnection()).toEqual(connection);
  });

  it('renews once on a 401 and sends the request again', async () => {
    const connection = await signedIn();
    platform.valid.clear();

    const answered = await authorizedRequest<{ details: { email: string } }>(connection, '/auth/session');

    expect(answered.ok && answered.value.reply.data.details.email).toBe('ada@example.com');
    expect(answered.ok && answered.value.connection.grant.accessToken).not.toBe(connection.grant.accessToken);
  });

  it('ends it on a second 401: the credential does not work, whatever the clock says', async () => {
    const connection = await signedIn();
    platform.refuseAll = true;

    const answered = await authorizedRequest(connection, '/auth/session');

    expect(answered.ok).toBe(false);
    expect(await readConnection()).toBeUndefined();
  });
});

describe('signing out', () => {
  it('revokes the grant on the platform and forgets it here', async () => {
    const connection = await signedIn();

    await disconnect();

    expect(platform.revoked).toEqual([connection.grant.refreshToken]);
    expect(await readConnection()).toBeUndefined();
  });
});

describe('which platform', () => {
  it('is --api, then PLITZI_API_URL, then the one connected to, then Plitzi’s own', async () => {
    await writeConnection({ api: 'https://api.plitzi.local', grant: { clientId: 'c', accessToken: 'a' } });
    const connection = await readConnection();

    expect(resolveApi('https://api.given.test/', connection)).toBe('https://api.given.test');
    process.env.PLITZI_API_URL = 'https://api.env.test';
    expect(resolveApi(undefined, connection)).toBe('https://api.env.test');
    delete process.env.PLITZI_API_URL;
    expect(resolveApi(undefined, connection)).toBe('https://api.plitzi.local');
    expect(resolveApi(undefined, undefined)).toBe('https://api.plitzi.com');
    expect(resolveApi('not an address', undefined)).toBeUndefined();
  });
});
