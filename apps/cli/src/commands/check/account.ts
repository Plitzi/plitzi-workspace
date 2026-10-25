import chalk from 'chalk';

import { openPage } from '@plitzi/sdk-authoring';

import { PROJECT_QUIET_MS } from '../../browser';
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
  // for it (every `--as` line failed in its checked copy).
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
  // Unreached is said, not thrown: a `--url` with no port ended the command in a stack trace (a run's lead).
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

/**
 * The session cookie of the account, signed in through the server's `/auth` routes with a plain request — for a
 * command that reads the site's pages without a browser (a look finding its pages' links) — or why it could not be.
 */
export const sessionCookie = async (origin: string, account: Account): Promise<string | { problem: string }> => {
  const answer = await fetch(`${origin}${SIGN_IN_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: account.username, password: account.password }),
    redirect: 'manual'
  }).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));
  if (answer instanceof Error) {
    return { problem: `nothing answered at ${origin} to sign in as ${account.username} (${answer.message})` };
  }

  const cookies = answer.headers.getSetCookie().map(cookie => cookie.split(';')[0]);

  return answer.status < 400 && cookies.length > 0
    ? cookies.join('; ')
    : { problem: `${account.username} was not signed in at ${SIGN_IN_PATH} (${String(answer.status)})` };
};

/** The project's own account (`PLITZI_CHECK_USER`), for a page that sends a guest away — none when it names none. */
export const projectAccount = async (root: string): Promise<Account | undefined> => {
  const account = await checkAccount(root);

  return account === undefined || 'problem' in account ? undefined : account;
};

/** A page read signed in as the project's account by itself: who, and where it sent a guest. */
export interface SignedInWhereSent {
  as: string;
  from: string;
}

/**
 * A page that sent a guest elsewhere — to the sign-in — read again signed in as the project's account, when none was
 * asked (`--as`) nor a guest's view (`--guest`): seven page commands in ten of two runs said `--as`, and one that
 * forgot read the sign-in panel as the page. Nothing when it stayed, or the project names no account.
 */
export const signInWhereSent = async (
  page: BrowserPage,
  origin: string,
  pathname: string,
  account: Account | undefined
): Promise<SignedInWhereSent | { problem: string } | undefined> => {
  const from = sentElsewhere(page, pathname);
  if (from === undefined || account === undefined) {
    return undefined;
  }

  const refused = await signInAs(page, origin, account);
  if (refused !== undefined) {
    return { problem: `${pathname} sends a guest to ${from}, and ${refused}` };
  }

  await openPage(page, `${origin}${pathname}`, { quietMs: PROJECT_QUIET_MS });

  return { as: account.username, from };
};

/** What a page command says of a page it read signed in by itself, apart from what it answers. */
export const signedInNote = (pathname: string, signed: SignedInWhereSent): string =>
  `· ${pathname} sends a guest to ${signed.from}: read signed in as ${signed.as}, the project's account (--as another, --guest as a guest)`;

const saidSignedIn = new Set<string>();

/** Said once a page — a play at two widths reads it twice — where an answer read as JSON is not. */
export const saySignedIn = (pathname: string, signed: SignedInWhereSent): void => {
  const note = signedInNote(pathname, signed);
  if (!saidSignedIn.has(note)) {
    saidSignedIn.add(note);
    process.stderr.write(`${chalk.dim(note)}\n`);
  }
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
