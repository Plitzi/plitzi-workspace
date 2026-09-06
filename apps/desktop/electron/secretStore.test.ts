import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createSecretStore } from './secretStore';

/**
 * A stand-in for the platform keyring.
 *
 * Reversible, tagged so foreign bytes are refused the way `safeStorage` refuses them — and it must not leave the
 * plaintext lying in the output, or the test that the value never hits the disk in the clear would pass for a
 * store that wrote it there.
 */
const MARK = 'plitzi';
const encrypt = (value: string) => Buffer.from(`${MARK}${Buffer.from(value, 'utf-8').toString('base64')}`, 'utf-8');
const decrypt = (buffer: Buffer) => {
  const text = buffer.toString('utf-8');
  if (!text.startsWith(MARK)) {
    throw new Error('not our ciphertext');
  }

  return Buffer.from(text.slice(MARK.length), 'base64').toString('utf-8');
};

const store = async (available = true) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'plitzi-desktop-'));
  const file = path.join(dir, 'session.bin');

  return { file, secrets: createSecretStore({ file, encrypt, decrypt, available: () => available }) };
};

describe('the desktop session store', () => {
  it('reads back what it wrote', async () => {
    const { secrets } = await store();
    await secrets.write('a-session');

    expect(await secrets.read()).toBe('a-session');
  });

  it('never writes the value in the clear', async () => {
    const { file, secrets } = await store();
    await secrets.write('a-session');

    expect((await readFile(file)).toString('utf-8')).not.toContain('a-session');
  });

  it('has nothing to read before anything was written', async () => {
    const { secrets } = await store();

    expect(await secrets.read()).toBeUndefined();
  });

  it('forgets the session on clear', async () => {
    const { secrets } = await store();
    await secrets.write('a-session');
    await secrets.clear();

    expect(await secrets.read()).toBeUndefined();
  });

  it('clears a session that was never there', async () => {
    const { secrets } = await store();

    await expect(secrets.clear()).resolves.toBeUndefined();
  });

  /**
   * A keyring that was reset, a profile copied to another machine, a half-written file. All of them mean the same
   * thing to this app — sign in again — so none of them may reach the renderer as a failure it has to handle.
   */
  it('answers unreadable contents as no session at all', async () => {
    const { file, secrets } = await store();
    await writeFile(file, Buffer.from('someone else’s bytes', 'utf-8'));

    expect(await secrets.read()).toBeUndefined();
  });

  it('stores nothing at all where the platform cannot encrypt', async () => {
    const { file, secrets } = await store(false);
    await secrets.write('a-session');

    await expect(readFile(file)).rejects.toThrow();
    expect(await secrets.read()).toBeUndefined();
  });
});
