import { copyOf } from '../../runs/paths';
import { projectSettings } from '../projectSettings';
import { fail } from '../terminal';

import type { BrowserPage } from '../../browser';

/**
 * A page for signed-in visitors, checked signed in: the account `--as` names, signed in through the space's own page.
 */

/** The account `verify` signs in as for the pages that send a visitor to sign in: the project's, in `.env`. */
export const CHECK_USER_ENV = 'PLITZI_CHECK_USER';

/** Where the account's password is read: `.env` or the environment, never the command line, which a shell keeps. */
export const CHECK_PASSWORD_ENV = 'PLITZI_CHECK_PASSWORD';

/** The project's sign-in route: where `createServer({ auth })` mounts its flows unless told otherwise. */
const SIGN_IN_PATH = '/auth/login';

export interface Account {
  username: string;
  password: string;
}

/**
 * The account a check signs in as: the one named, or the project's own (`PLITZI_CHECK_USER`) — `undefined` when
 * neither is — with its password from `PLITZI_CHECK_PASSWORD`, each read from the environment over `.env`, as the
 * project's scripts read them.
 */
export const checkAccount = async (
  root: string,
  username?: string
): Promise<Account | { problem: string } | undefined> => {
  // A task's copy has no .env — its agent never reads one: the account is its project's, read here for it.
  const copy = copyOf(root);
  const [own, project] = await Promise.all([
    projectSettings(root),
    copy ? projectSettings(copy.root) : Promise.resolve(undefined)
  ]);
  const value = (name: string): string => own.value(name) || (project?.value(name) ?? '');
  const named = username ?? value(CHECK_USER_ENV);
  if (!named) {
    return undefined;
  }

  const password = value(CHECK_PASSWORD_ENV);
  if (!password) {
    return {
      problem: `${named} signs in with the password in ${CHECK_PASSWORD_ENV}: set it in the project's .env — never on the command line, which a shell keeps${copy ? ' (a task’s copy reads its project’s)' : ''}`
    };
  }

  return { username: named, password };
};

/**
 * The account a page command was asked to sign in as (`--as`): none when it was not asked, and `null` — said — when
 * it cannot be (no password): the command stops there.
 */
export const accountAsked = async (root: string, username: string | undefined): Promise<Account | undefined | null> => {
  if (username === undefined) {
    return undefined;
  }

  const account = await checkAccount(root, username);
  if (account === undefined || 'problem' in account) {
    fail(`--as ${account === undefined ? `${username}: no account to sign in as` : account.problem}.`);

    return null;
  }

  return account;
};

/** Signs the page's browser in as the account, through the server's `/auth` routes: what went wrong, or nothing. */
export const signInAs = async (page: BrowserPage, origin: string, account: Account): Promise<string | undefined> => {
  const answer = await page.request.post(`${origin}${SIGN_IN_PATH}`, {
    data: { username: account.username, password: account.password }
  });
  if (answer.ok()) {
    return undefined;
  }

  return answer.status() === 404
    ? `nothing answers at ${SIGN_IN_PATH}: --as signs in through the routes createServer({ auth }) mounts there`
    : `${account.username} was not signed in (${String(answer.status())}): ${(await answer.text()).slice(0, 200)} — check ${CHECK_PASSWORD_ENV} in .env`;
};

const withoutTrailingSlash = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/** Where the page landed, when that is not the path it was opened at — sent to the sign-in, most often. */
export const sentElsewhere = (page: BrowserPage, pathname: string): string | undefined => {
  const landed = new URL(page.url()).pathname;
  const asked = new URL(pathname, page.url()).pathname;

  return withoutTrailingSlash(landed) === withoutTrailingSlash(asked) ? undefined : landed;
};
