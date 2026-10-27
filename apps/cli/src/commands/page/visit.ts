import { audienceAt, openPage } from '@plitzi/sdk-authoring';
import { SPACE_FAILURE_META } from '@plitzi/sdk-shared/devTools';

import { launchBrowser, openProjectPage, projectSettling } from '../../browser';
import { checkAccount, projectAccount, saySignedIn, signInAs, signInWhereSent } from './check/account';
import { noPageAt, pageFor } from './check/space';
import { authoredSpace } from '../../runs/plan/expectations';
import { conditionsOf } from '../register/options';
import { fail, unanswered } from '../shared/terminal';

import type { Browser, BrowserPage, ProjectView } from '../../browser';
import type { Account } from './check/account';
import type { VisitorOptions } from '../register/options';
import type { SpaceHandles } from '@plitzi/sdk-authoring';
import type { Schema } from '@plitzi/sdk-shared';

/**
 * A page of the project visited as a visitor would: one way for every page command — `page check`, `measure`, `play`,
 * `outline`, `same`, `shot` and the looks — where each had its own (four of them), and each took a different part of
 * the visitor's options (the browser's conditions only on two, the time zone on five, an account on six).
 */

/** The viewport's height every page is read at, unless a command asks otherwise: said with what it read. */
export const VIEW_HEIGHT = 900;

/** The visitor: its viewport, theme, zone, whether it takes part in channels, its browser — and others' pictures. */
export interface VisitView extends Omit<ProjectView, 'height'> {
  height?: number;
  /** Another site's pictures stood in for, each by a colour of its own: a look at what the project changed. */
  standIns?: boolean;
}

/** The visitor's view a page command's flags ask for (`withVisitorOptions`): its zone, its channels, its browser. */
export const visitViewOf = (options: VisitorOptions): Pick<VisitView, 'timezone' | 'presence' | 'conditions'> => {
  const conditions = conditionsOf(options);

  return {
    ...(options.timezone ? { timezone: options.timezone } : {}),
    ...(options.presence ? { presence: true } : {}),
    ...(Object.keys(conditions).length > 0 ? { conditions } : {})
  };
};

/**
 * Said when a page is read in a zone at UTC's own time now: a time the page prints beside UTC reads as UTC alone, its
 * short form — never the longer one a visitor elsewhere reads. A run's scout measured two plates a row at Lisbon in
 * October, and a visitor's "Tomorrow 17:39 · 16:39 UTC" overflowed them.
 */
export const zoneNote = (zone: string, now: Date): string | undefined => {
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
    .formatToParts(now)
    .find(part => part.type === 'timeZoneName')?.value;

  // An offset of none is "GMT" or "GMT+0", as the runtime's ICU writes it.
  return offset === 'GMT' || offset === 'GMT+0'
    ? `${zone} is at UTC's own time now: a time a page prints beside UTC reads as one — --timezone America/New_York reads it as a visitor elsewhere does`
    : undefined;
};

/** One colour a picture's address always gets: the same picture the same on both sides, another one another. */
export const standIn = (url: string): string => {
  let hue = 7;
  for (let index = 0; index < url.length; index += 1) {
    hue = (hue * 31 + url.charCodeAt(index)) % 360;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="hsl(${String(hue)} 35% 55%)"/></svg>`;
};

/** Every picture from another site than `origin`, answered by its stand-in (`VisitView.standIns`). */
export const standInPictures = (page: BrowserPage, origin: string): Promise<void> =>
  page.route(
    url => url.origin !== origin,
    async route =>
      route.request().resourceType() === 'image'
        ? route.fulfill({ status: 200, contentType: 'image/svg+xml', body: standIn(route.request().url()) })
        : route.fallback()
  );

/**
 * A page made ready for the visit, before it goes anywhere: its view, its browser's conditions, others' pictures stood
 * in for — and signed in first as `account` (`--as`). A command that listens to the page's requests from its first one
 * (`page check`) opens the address itself after this.
 */
export const prepareVisit = async (
  browser: Browser,
  origin: string,
  view: VisitView,
  account?: Account
): Promise<{ page: BrowserPage; problem?: string }> => {
  const { standIns, height = VIEW_HEIGHT, ...asView } = view;
  const page = await openProjectPage(browser, origin, { ...asView, height });
  if (standIns) {
    await standInPictures(page, origin);
  }

  // Signed in first when asked: a page for signed-in visitors read as one of them.
  const refused = account && (await signInAs(page, origin, account));

  return refused ? { page, problem: `--as ${refused}` } : { page };
};

/** Why the page is the server's own rather than the space's — the space does not author — or nothing. */
export const spaceFailureOn = async (page: BrowserPage): Promise<string | undefined> =>
  page
    .evaluate(meta => {
      if (!document.querySelector(`meta[name="${meta}"]`)) {
        return undefined;
      }

      // What it refused, not a count of it: a run's dev-2 read "3 problems" and nothing it could fix.
      const lines = (document.querySelector('pre')?.textContent ?? '')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
      const said = `${lines.slice(0, 6).join(' · ')}${lines.length > 6 ? ' …' : ''}`;

      return `the space does not author, so the page is the server's error page${said ? ` — ${said}` : ''}: npm run author says why`;
    }, SPACE_FAILURE_META)
    .catch(() => undefined);

const PASSED_KEY = '__plitzi_passed';

/** The addresses a page showed as it opened, each for how long — read off what the page logged, since `since`. */
export const passedOf = (logged: string, since: number): { path: string; ms: number }[] => {
  let read: unknown;
  try {
    read = JSON.parse(logged);
  } catch {
    read = [];
  }

  const shown = (Array.isArray(read) ? read : [])
    .flatMap(entry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof Reflect.get(entry, 'path') === 'string' &&
      typeof Reflect.get(entry, 'at') === 'number'
        ? [{ path: String(Reflect.get(entry, 'path')), at: Number(Reflect.get(entry, 'at')) }]
        : []
    )
    .filter(entry => entry.at >= since)
    .filter((entry, index, all) => index === 0 || all[index - 1]?.path !== entry.path);

  return shown.map((entry, index) => ({ path: entry.path, ms: (shown[index + 1]?.at ?? entry.at) - entry.at }));
};

/**
 * Who the visit is: an account asked (`--as`), else the project's — at a page for its members, or one that sends a guest
 * away (`--guest`: none).
 */
export interface Visitor {
  account?: Account;
  projectAccount?: Account;
  /**
   * Whether the space reads `route` as its members' — members only by its router, a gate that shows a guest another page,
   * kept for some permissions: read signed in as the project's account, as a look reads it. Every page command reads it
   * so — `page measure` read a guest's where `task look` read the account's, one element drawn in one and not the other
   * (a run's designer).
   */
  membersAt?: (route: string) => boolean;
}

/** What a page command says of a path no page of the space answers: its not-found page was what it read. */
export const noPageNote = async (root: string, route: string): Promise<string | undefined> => {
  const authored = await authoredSpace(root);
  if (authored === undefined || !noPageAt(authored, route.split(/[?#]/)[0])) {
    return undefined;
  }

  return `· ${route} is no page of the space — what was read is its not-found page: plitzi space overview names its pages`;
};

/** Whether the authored space reads `route` as its members' page: what a visitor of a page command signs in for. */
export const readsAsMember = (authored: { schema: Schema; handles: SpaceHandles }, route: string): boolean => {
  const id = pageFor(authored, route);
  const page = id !== undefined && Object.hasOwn(authored.handles.pages, id) ? authored.handles.pages[id] : undefined;
  const audience = audienceAt(authored.schema, route);

  return audience === 'members' || audience === 'gated' || (page?.access?.permissions.length ?? 0) > 0;
};

/**
 * Who a page command reads as, from its flags: the account asked (`--as`), else the project's where a page sends a guest
 * away — none with `--guest`, nor when `own` is false (another site's page). `null` once the refusal was said.
 */
export const visitorAsked = async (
  root: string,
  options: Pick<VisitorOptions, 'as' | 'guest'>,
  { own = true }: { own?: boolean } = {}
): Promise<Visitor | null> => {
  if (options.as !== undefined) {
    const account = await checkAccount(root, options.as);
    if (account === undefined || 'problem' in account) {
      fail(`--as ${account === undefined ? `${options.as}: no account to sign in as` : account.problem}.`);

      return null;
    }

    return { account };
  }

  const project = own && options.guest !== true ? await projectAccount(root) : undefined;
  if (!project) {
    return {};
  }

  const authored = await authoredSpace(root);

  return {
    projectAccount: project,
    ...(authored ? { membersAt: (route: string) => readsAsMember(authored, route) } : {})
  };
};

/**
 * Who reads and the browser it reads in: what every page command makes ready before its first page — a refusal said
 * as each says it (`--as` as the asker's, a browser that does not start as unanswered), `undefined` then.
 */
export const visitorBrowser = async (
  root: string,
  options: Pick<VisitorOptions, 'as' | 'guest'>,
  asked: { own?: boolean } = {}
): Promise<{ visitor: Visitor; browser: Browser } | undefined> => {
  const visitor = await visitorAsked(root, options, asked);
  if (visitor === null) {
    return undefined;
  }

  const browser = await launchBrowser(root);
  if ('problem' in browser) {
    unanswered(browser.problem);

    return undefined;
  }

  return { visitor, browser };
};

/**
 * A page of the project visited whole: made ready (`prepareVisit`), opened, signed in where it sends a guest away, its
 * fonts in and the space hydrated — what a visitor's browser reads. What it opened through by itself is said
 * (`passed`), and a page read signed out too (`signedOut`).
 */
export const openVisit = async (
  browser: Browser,
  origin: string,
  route: string,
  view: VisitView & Visitor
): Promise<{
  page: BrowserPage;
  answered: boolean;
  problem?: string;
  signedOut?: true;
  /** The addresses it showed as it opened, each for how long, when the page sent the browser on by itself. */
  passed?: { path: string; ms: number }[];
}> => {
  const { account: asked, projectAccount, membersAt, ...asView } = view;
  // A members' page read as the project's account from the start: what a guest would be shown in its place is not it.
  const account = asked ?? (membersAt?.(route) === true ? projectAccount : undefined);
  const { page, problem } = await prepareVisit(browser, origin, { reducedMotion: true, ...asView }, account);
  if (problem !== undefined) {
    return { page, answered: false, problem };
  }

  // Where the page went as it opened, by itself — a flow's navigate on load: a run's designer played a page that
  // sends a signed-in visitor on, and its start was read on where it landed, the flash of its own form unseen.
  const openedAt = Date.now();
  await page.addInitScript(key => {
    // The browser's own first document (about:blank) is no address the page showed: a run's play said "→ blank".
    if (!location.protocol.startsWith('http')) {
      return;
    }

    const log = (): void => {
      const list = JSON.parse(sessionStorage.getItem(key) ?? '[]') as unknown[];
      list.push({ path: `${location.pathname}${location.search}`, at: Date.now() });
      sessionStorage.setItem(key, JSON.stringify(list));
    };
    log();
    for (const name of ['pushState', 'replaceState'] as const) {
      const original = history[name].bind(history);
      history[name] = (...args: Parameters<History['pushState']>) => {
        original(...args);
        log();
      };
    }
  }, PASSED_KEY);
  const answered = (await openPage(page, `${origin}${route}`, projectSettling(page))) !== null;
  if (!answered) {
    return { page, answered };
  }

  const passed = passedOf(
    await page.evaluate(key => sessionStorage.getItem(key) ?? '[]', PASSED_KEY).catch(() => '[]'),
    openedAt
  );

  const signed = account ? undefined : await signInWhereSent(page, origin, route, projectAccount);
  if (signed && 'problem' in signed) {
    return { page, answered: false, problem: signed.problem };
  }

  if (signed) {
    saySignedIn(route, signed);
  }

  // The server's own page while the space does not author: said, never "No element …" of every element asked.
  const failed = await spaceFailureOn(page);
  if (failed !== undefined) {
    return { page, answered: false, problem: failed };
  }

  // A text the browser rewrites after hydration (a visitor's time, read in its zone) read before it was the server's:
  // A run's hero read "19:00H CEST" once, "11:00H GMT-6" after. A page with no space root has no wait.
  await page.waitForSelector('[data-hydrated]', { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined), undefined);

  return {
    page,
    answered,
    ...(account || signed ? {} : { signedOut: true as const }),
    ...(passed.length > 1 ? { passed } : {})
  };
};
