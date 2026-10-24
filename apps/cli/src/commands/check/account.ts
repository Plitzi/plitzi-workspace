import { runProjectOf } from '../../runs/paths';
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
  // A run's folder has no .env — a task's copy, the finish's checked copy: the account is its project's, read here
  // for it (encore's finish: every `--as` line failed in its checked copy).
  const project = runProjectOf(root);
  const [own, projects] = await Promise.all([
    projectSettings(root),
    project ? projectSettings(project) : Promise.resolve(undefined)
  ]);
  const value = (name: string): string => own.value(name) || (projects?.value(name) ?? '');
  const named = username ?? value(CHECK_USER_ENV);
  if (!named) {
    return undefined;
  }

  const password = value(CHECK_PASSWORD_ENV);
  if (!password) {
    return {
      problem: `${named} signs in with the password in ${CHECK_PASSWORD_ENV}: set it in the project's .env — never on the command line, which a shell keeps${project ? ' (a run’s copy reads its project’s)' : ''}`
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
  // Unreached is said, not thrown: a `--url` with no port ended the command in a stack trace (encore's lead).
  const answer = await page.request
    .post(`${origin}${SIGN_IN_PATH}`, { data: { username: account.username, password: account.password } })
    .catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));
  if (answer instanceof Error) {
    return `nothing answered at ${origin} to sign in as ${account.username} (${answer.message.split('\n')[0]}): is the server up, and --url its address with its port?`;
  }

  if (answer.ok()) {
    return undefined;
  }

  return answer.status() === 404
    ? `nothing answers at ${SIGN_IN_PATH}: --as signs in through the routes createServer({ auth }) mounts there`
    : `${account.username} was not signed in (${String(answer.status())}): ${(await answer.text()).slice(0, 200)} — check ${CHECK_PASSWORD_ENV} in .env`;
};

const withoutTrailingSlash = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path);

const landedElsewhere = (url: string, pathname: string): string | undefined => {
  const landed = new URL(url).pathname;
  const asked = new URL(pathname, url).pathname;

  return withoutTrailingSlash(landed) === withoutTrailingSlash(asked) ? undefined : landed;
};

/** Where the page landed, when that is not the path it was opened at — sent to the sign-in, most often. */
export const sentElsewhere = (page: BrowserPage, pathname: string): string | undefined =>
  landedElsewhere(page.url(), pathname);

/**
 * What is wrong with where a checked page landed (`url`): anywhere but `--redirects-to` when that names a page, anywhere
 * but the page asked when it does not — a page for signed-in visitors sends a guest to the sign-in, and every element of
 * it would read as missing.
 */
export const landingProblem = (
  url: string,
  pathname: string,
  meant: string | undefined,
  account: Account | undefined
): string | undefined => {
  const landed = landedElsewhere(url, pathname);
  if (meant !== undefined) {
    return landedElsewhere(url, meant) === undefined
      ? undefined
      : `${pathname} was meant to send the browser to ${meant} (--redirects-to), and ${landed === undefined ? 'it stayed' : `it went to ${landed}`}`;
  }

  if (landed === undefined) {
    return undefined;
  }

  return account
    ? `${pathname} sent the browser to ${landed}, signed in as ${account.username}: that account may not see it`
    : `${pathname} sent the browser to ${landed} — what a page for signed-in visitors does: \`plitzi page check ${pathname} --as <username>\` signs in first, the password in ${CHECK_PASSWORD_ENV} in .env — or \`--redirects-to ${landed}\` when that is what it is meant to do`;
};
