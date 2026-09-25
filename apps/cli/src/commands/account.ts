import chalk from 'chalk';

import { readConnection, resolveApi } from '../account/connection';
import { openBrowser } from '../account/oauth';
import { authorizedRequest, connect, currentConnection, disconnect } from '../account/session';

import type { Connection } from '../account/connection';
import type { Outcome } from '../account/session';

/**
 * `plitzi login`, `logout`, `whoami` and `space`: the CLI's one connection to the platform, made in the browser.
 *
 * The browser because the platform's auth is the one place credentials are granted — the CLI never asks for a
 * password, and choosing a space happens on the same grant screen an AI connector's does. See `account/session`.
 */

export interface AccountOptions {
  api?: string;
}

/** The address to open, printed as well: over SSH, or with no browser to start, it is opened by hand. */
export const openInBrowser = (url: string): void => {
  console.log(`\nContinue in your browser. If it did not open, go to:\n  ${chalk.cyan(url)}`);
  openBrowser(url);
};

/** The platform this command talks to, or undefined — said — when `--api` or `PLITZI_API_URL` is not an address. */
export const apiFor = async (options: AccountOptions): Promise<string | undefined> => {
  const api = resolveApi(options.api, await readConnection());
  if (!api) {
    console.error(chalk.red(`"${options.api ?? process.env.PLITZI_API_URL ?? ''}" is not an address.`));
    process.exitCode = 1;
  }

  return api;
};

export const fail = (error: string): void => {
  console.error(chalk.red(error));
  process.exitCode = 1;
};

/** Who the connection signs in as, asked of the platform — which also proves the session still works. */
const whoIs = async (connection: Connection): Promise<Outcome<string>> => {
  const answered = await authorizedRequest<{ details?: { email?: string; username?: string } }>(
    connection,
    '/auth/session'
  );
  if (!answered.ok) {
    return answered;
  }

  const { reply } = answered.value;
  if (reply.status !== 200) {
    return { ok: false, error: `${connection.api} would not say who you are (${reply.status}).` };
  }

  return { ok: true, value: reply.data.details?.email || reply.data.details?.username || 'you' };
};

const spaceLine = (connection: Connection): string =>
  connection.space
    ? `Space: ${chalk.bold(connection.space.name)} ${chalk.dim(`(${connection.space.permanentUrl})`)}`
    : chalk.dim('No space chosen: choose one with plitzi space.');

export const login = async (options: AccountOptions): Promise<void> => {
  const api = await apiFor(options);
  if (!api) {
    return;
  }

  const current = await currentConnection(api);
  if (current.ok && current.value) {
    const who = await whoIs(current.value);
    if (who.ok) {
      console.log(`\nSigned in to ${api} as ${chalk.bold(who.value)} already.`);
      console.log(chalk.dim('To sign in as somebody else: plitzi logout, then plitzi login.\n'));

      return;
    }
  }

  const previous = await readConnection();
  const connected = await connect(api, { open: openInBrowser });
  if (!connected.ok) {
    fail(connected.error);

    return;
  }

  const who = await whoIs(connected.value);
  console.log(chalk.green(`\nSigned in to ${api}${who.ok ? ` as ${who.value}` : ''}.`));
  if (previous && previous.api !== api) {
    console.log(chalk.dim(`The CLI is connected to one platform at a time: ${previous.api} is signed out.`));
  }

  console.log(`${spaceLine(connected.value)}\n`);
};

export const logout = async (): Promise<void> => {
  const connection = await disconnect();
  console.log(connection ? `\nSigned out of ${connection.api}.\n` : '\nNot signed in.\n');
};

export const whoami = async (options: AccountOptions): Promise<void> => {
  const api = await apiFor(options);
  if (!api) {
    return;
  }

  const current = await currentConnection(api);
  if (!current.ok) {
    fail(current.error);

    return;
  }

  if (!current.value) {
    fail(`Not signed in to ${api}. Sign in with plitzi login.`);

    return;
  }

  const who = await whoIs(current.value);
  if (!who.ok) {
    fail(who.error);

    return;
  }

  console.log(`\nSigned in to ${api} as ${chalk.bold(who.value)}.`);
  console.log(`${spaceLine(current.value)}\n`);
};

/**
 * The space to work in, chosen on the platform's grant screen. The connection is REPLACED by the new grant — the CLI
 * works in one space at a time, and the space it worked in before is no longer reachable from it.
 */
export const chooseSpace = async (api: string): Promise<Outcome<Connection>> => {
  const connected = await connect(api, { scope: 'space', open: openInBrowser });
  if (connected.ok && !connected.value.space) {
    return { ok: false, error: 'No space was chosen.' };
  }

  return connected;
};

export const space = async (options: AccountOptions): Promise<void> => {
  const api = await apiFor(options);
  if (!api) {
    return;
  }

  const connected = await chooseSpace(api);
  if (!connected.ok) {
    fail(connected.error);

    return;
  }

  console.log(chalk.green(`\nConnected to ${api}.`));
  console.log(`${spaceLine(connected.value)}\n`);
};
