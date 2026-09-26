import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { Grant } from './oauth';

/**
 * What the CLI is connected to: ONE platform, as ONE person, working in at most ONE space.
 *
 * One and not a list, on purpose. A command that acts on a space — an upload today — acts on the one `plitzi whoami`
 * names, and nothing it can be passed makes it act on another: two connections side by side is how a plugin meant for
 * a staging space ends up in the live one. Changing space replaces the connection; it never adds a second.
 *
 * Kept in the user's config directory, readable by them alone. The file holds a session, which is as good as being
 * signed in — the same thing a browser keeps in its cookie jar.
 */

export interface ConnectedSpace {
  id: number;
  name: string;
  permanentUrl: string;
}

export interface Connection {
  /** The platform's API, without a trailing slash: `https://api.plitzi.com`. */
  api: string;
  grant: Grant;
  space?: ConnectedSpace;
}

export const DEFAULT_API = 'https://api.plitzi.com';

/** `$XDG_CONFIG_HOME/plitzi`, `%APPDATA%\plitzi` on Windows, `~/.config/plitzi` otherwise. */
export const configDir = (): string => {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'plitzi');
  }

  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'plitzi');
  }

  return path.join(os.homedir(), '.config', 'plitzi');
};

const connectionFile = (): string => path.join(configDir(), 'connection.json');

const isConnection = (value: unknown): value is Connection => {
  const candidate = value as Partial<Connection> | null;

  return (
    typeof candidate?.api === 'string' &&
    typeof candidate.grant?.clientId === 'string' &&
    typeof candidate.grant.accessToken === 'string'
  );
};

/** The connection, or undefined when there is none — or the file is not one, which is the same as none. */
export const readConnection = async (): Promise<Connection | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(connectionFile(), 'utf-8'));

    return isConnection(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const writeConnection = async (connection: Connection): Promise<void> => {
  await fs.mkdir(configDir(), { recursive: true, mode: 0o700 });
  await fs.writeFile(connectionFile(), `${JSON.stringify(connection, null, 2)}\n`, { mode: 0o600 });
  // `mode` applies only when the file is created: one written by an older version keeps whatever it had.
  await fs.chmod(connectionFile(), 0o600);
};

export const forgetConnection = async (): Promise<void> => {
  await fs.rm(connectionFile(), { force: true });
};

/** An API address as it is compared and stored: its origin plus any path, no trailing slash. */
export const normalizeApi = (value: string): string => {
  const url = new URL(value);

  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
};

/**
 * Which platform a command talks to: `--api`, else `PLITZI_API_URL`, else the one connected to, else Plitzi's own.
 * Undefined when what was given is not an address.
 */
export const resolveApi = (given: string | undefined, connection: Connection | undefined): string | undefined => {
  const chosen = given ?? process.env.PLITZI_API_URL ?? connection?.api ?? DEFAULT_API;
  try {
    return normalizeApi(chosen);
  } catch {
    return undefined;
  }
};
