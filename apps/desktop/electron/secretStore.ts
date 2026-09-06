import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type SecretStoreOptions = {
  file: string;
  encrypt: (value: string) => Buffer;
  decrypt: (value: Buffer) => string;
  available: () => boolean;
};

export type SecretStore = {
  read: () => Promise<string | undefined>;
  write: (value: string) => Promise<void>;
  clear: () => Promise<void>;
};

/**
 * One string, encrypted at rest by the operating system.
 *
 * Every failure answers the same way — as "there is nothing stored" — and that is deliberate. What is kept here is
 * a session: a machine whose keyring was reset, a profile copied to another machine, a file truncated by a crash
 * all mean the same thing to this app, which is that the person signs in again. Reporting them apart would only
 * give the sign-in screen error states nobody can act on.
 *
 * A platform with no encryption backend (a Linux box with no keyring) stores nothing rather than falling back to
 * plaintext: a credential written to disk in the clear because the good path was unavailable is the failure this
 * exists to prevent.
 */
export const createSecretStore = ({ file, encrypt, decrypt, available }: SecretStoreOptions): SecretStore => ({
  read: async () => {
    if (!available()) {
      return undefined;
    }

    try {
      return decrypt(await readFile(file));
    } catch {
      return undefined;
    }
  },

  write: async value => {
    if (!available()) {
      return;
    }

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, encrypt(value), { mode: 0o600 });
  },

  clear: async () => {
    await rm(file, { force: true });
  }
});

export default createSecretStore;
