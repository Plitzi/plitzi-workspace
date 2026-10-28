import { readFile } from 'node:fs/promises';
import https from 'node:https';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { HIDE_DEV_TOOLS_CSS } from '@plitzi/sdk-shared/devTools';
import { isRecord } from '@plitzi/sdk-shared/helpers';
import { projectMark } from '@plitzi/sdk-shared/project';
import { OBSERVER_COOKIE_NAME } from '@plitzi/sdk-shared/realtime';
import { THEME_COOKIE_NAME } from '@plitzi/sdk-shared/theme';

import { applyConditions, heldOn } from './conditions';
import { keepStatic, staticCacheDir } from './staticCache';
import { DEV_SERVER_FILE } from '../scaffold/paths';

import type { BrowserConditions } from './conditions';
import type { PlitziProject } from '../commands/project/existingProject';
import type { SettlingEvent, SettlingRequest } from '@plitzi/sdk-authoring';

/**
 * A browser on the project's own Playwright, and the project's own server to point it at — what `plitzi page check`,
 * `plitzi page shot` and `plitzi page import` look at a page with (`import` at a site of the person's, not the project's server).
 *
 * Playwright is the project's: `create` installs it for the visual tests, and a second copy in the CLI would be a
 * second set of browsers to download. It is described here by the little that is used of it, and checked to be that
 * when it loads, so the CLI depends on no driver.
 */

export const SCHEMES = ['light', 'dark'] as const;

export type Scheme = (typeof SCHEMES)[number];

export interface PageMessage {
  type(): string;
  text(): string;
  /** Where it was said from — for a resource that failed to load, that resource. */
  location(): { url: string };
}

/** A request the browser got no answer to. */
export interface FailedRequest {
  url(): string;
  resourceType(): string;
  failure(): { errorText: string } | null;
}

export interface PageResponse {
  status(): number;
  url(): string;
  headers(): Record<string, string>;
  /** The request it answers: what kind it was — the page's own `fetch` or `xhr`, a document, a picture. */
  request(): { resourceType(): string };
}

/** One element of a page, as `shot --within` and `--scroll-to` reach it, and `check --click` and `--fill` use it. */
export interface PageElement {
  screenshot(): Promise<Uint8Array>;
  scrollIntoViewIfNeeded(options?: { timeout: number }): Promise<void>;
  /** How many elements the selector finds: none is an element not on the page. */
  count(): Promise<number>;
  /** Whether it is drawn: on the page and not hidden — what a picture of it needs. */
  isVisible(): Promise<boolean>;
  click(options: { timeout: number }): Promise<void>;
  /** The pointer put over it, and left there: what a hover shows. */
  hover(options: { timeout: number }): Promise<void>;
  /** Focus put on it, as a keyboard leaves it: what `:focus-visible` shows. */
  focus(options: { timeout: number }): Promise<void>;
  /** The elements inside it the selector finds. */
  locator(selector: string): { first(): PageElement };
  /** A function run in the page on the element itself. */
  evaluate<R, A>(fn: (node: Element, input: A) => R, input: A): Promise<R>;
  fill(value: string, options: { timeout: number }): Promise<void>;
  setChecked(checked: boolean, options: { timeout: number }): Promise<void>;
  selectOption(value: string, options: { timeout: number }): Promise<unknown>;
  /** Where it is drawn on the screen, or null when it is not: what a drag presses at. */
  boundingBox(options: { timeout: number }): Promise<{ x: number; y: number; width: number; height: number } | null>;
}

/** A request the page made, held by `route`: answered here, or let through as it was. */
export interface PageRoute {
  request(): { resourceType(): string; url(): string; method(): string };
  fulfill(response: {
    status: number;
    contentType?: string;
    headers?: Record<string, string>;
    body: string | Uint8Array;
  }): Promise<void>;
  continue(): Promise<void>;
  /** Answered with a failure, as a request the network could not make: `--block`'s. */
  abort(): Promise<void>;
  /** On to the handler registered before this one — or the network, past the first. */
  fallback(): Promise<void>;
  /** The request made now, as the page would make it: its answer, to answer the page with. */
  fetch(): Promise<{ status(): number; headers(): Record<string, string>; body(): Promise<Uint8Array> }>;
}

/** What of Chromium's protocol a page command asks: a pseudo-element's box, which the page itself has none of. */
export interface LayoutSession {
  send(method: 'DOM.getDocument', params: { depth: number }): Promise<{ root: { nodeId: number } }>;
  send(method: 'DOM.querySelector', params: { nodeId: number; selector: string }): Promise<{ nodeId: number }>;
  send(
    method: 'DOM.describeNode',
    params: { nodeId: number; depth: number }
  ): Promise<{ node: { pseudoElements?: { pseudoType?: string; backendNodeId: number }[] } }>;
  send(method: 'DOM.getBoxModel', params: { backendNodeId: number }): Promise<{ model: { border: number[] } }>;
  detach(): Promise<void>;
}

export interface BrowserPage {
  goto(url: string, options: { waitUntil: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<unknown>;
  /** `clip`: the part of the page drawn, in its own coordinates — with `fullPage`, anywhere down the whole page. */
  screenshot(options: {
    fullPage: boolean;
    clip?: { x: number; y: number; width: number; height: number };
  }): Promise<Uint8Array>;
  /**
   * The first element the selector finds — Playwright's own, which scrolls whatever pane holds it into view — or the
   * first of them shown (`filter({ visible: true })`): a page that draws one control per width hides the other.
   */
  locator(selector: string): { first(): PageElement; filter(options: { visible: boolean }): { first(): PageElement } };
  evaluate<R, A>(fn: (input: A) => R | Promise<R>, input: A): Promise<R>;
  waitForSelector(selector: string, options: { timeout: number }): Promise<unknown>;
  waitForTimeout(milliseconds: number): Promise<void>;
  /** Until the page in the tab has loaded again — after a navigation, a reload its server asked for. */
  waitForLoadState(state: 'load'): Promise<void>;
  /** The keyboard, as a person types on it: into whatever has the focus. */
  keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
  /** The pointer, as a hand moves it: pressed, moved in steps, let go — a drag. */
  mouse: {
    move(x: number, y: number, options?: { steps: number }): Promise<void>;
    down(): Promise<void>;
    up(): Promise<void>;
  };
  /** A stylesheet added to the page as it is now: what a capture leaves out or holds still. */
  addStyleTag(options: { content: string }): Promise<unknown>;
  /** A function run in each document the page opens, before its own scripts. */
  addInitScript<A>(script: (input: A) => void, input: A): Promise<void>;
  /**
   * The browser context the page lives in — its cookies, set before the page is asked for — and Chromium's own
   * protocol on the page, for what the page does not say of itself.
   */
  context(): {
    addCookies(cookies: { name: string; value: string; url: string }[]): Promise<void>;
    newCDPSession(page: BrowserPage): Promise<LayoutSession>;
  };
  /** Where the page is now — after any redirect the server answered with. */
  url(): string;
  /** What the page asks for, answered here first: a picture of another site stood in for, the rest let through. */
  route(matcher: (url: URL) => boolean, handler: (route: PageRoute) => Promise<void>): Promise<void>;
  /** Closed once pictured: a run of many pages holds one at a time. */
  close(): Promise<void>;
  /** Loaded again, as a visitor's reload: what the page kept (its storage, a cookie) read back. */
  reload(options: { waitUntil: 'load' }): Promise<unknown>;
  /** The page's clock — `Date` and its timers — held from an instant and moved on by hand (`--clock`, `tick`). */
  clock: {
    install(options: { time: number }): Promise<void>;
    runFor(milliseconds: number): Promise<void>;
    setSystemTime(time: number): Promise<void>;
  };
  /** The viewport changed in place: a page of a shared context sized as its reader asks. */
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  /** The media a page answers to, set on the page alone: its colour scheme and motion in a shared context. */
  emulateMedia(media: { colorScheme: Scheme; reducedMotion: 'reduce' | 'no-preference' }): Promise<void>;
  /** Requests made as the page would make them, sharing its context's cookies: a sign-in here signs the page in. */
  request: {
    post(
      url: string,
      options: { data: Record<string, string> }
    ): Promise<{ ok(): boolean; status(): number; text(): Promise<string> }>;
    get(url: string): Promise<{ ok(): boolean; status(): number; text(): Promise<string> }>;
  };
  on(event: 'pageerror', listener: (error: Error) => void): unknown;
  on(event: 'console', listener: (message: PageMessage) => void): unknown;
  on(event: 'response', listener: (response: PageResponse) => void): unknown;
  /** A request that got no answer: why, as the browser says it (`net::ERR_TIMED_OUT`). */
  on(event: 'requestfailed', listener: (request: FailedRequest) => void): unknown;
  /** What `openPage` follows the page's requests by, to know when it has settled. */
  on(event: SettlingEvent, listener: (request: SettlingRequest) => void): unknown;
  off(event: SettlingEvent, listener: (request: SettlingRequest) => void): unknown;
}

/** A context of the browser's whose pages share what they fetched: its cache, its cookies. */
export interface BrowserContext {
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
}

export interface Browser {
  /** A context whose pages share their HTTP cache — the kept browser's, where the other site loads warm. */
  newContext(): Promise<BrowserContext>;
  newPage(options: {
    viewport: { width: number; height: number };
    colorScheme: Scheme;
    reducedMotion: 'reduce' | 'no-preference';
    ignoreHTTPSErrors?: boolean;
    /** The visitor's time zone (IANA), the browser's clock and `Intl` read in: the machine's when left out. */
    timezoneId?: string;
    /** Device pixels a CSS pixel: a picture `n` times as large, a small drawing read up close. */
    deviceScaleFactor?: number;
  }): Promise<BrowserPage>;
  close(): Promise<void>;
}

export interface Chromium {
  launch(): Promise<Browser>;
}

const isChromium = (value: unknown): value is Chromium => isRecord(value) && typeof value.launch === 'function';

/** A property of an object or of a function, which a module's exports can be either of. */
const propertyOf = (value: unknown, key: string): unknown =>
  (typeof value === 'object' || typeof value === 'function') && value !== null ? Reflect.get(value, key) : undefined;

/**
 * How long a page of the project's own server waits with no request open before it is read: half of `openPage`'s 500,
 * for another site. Four of a run's pages at two widths read the same, cold and warm, five times each, at 500, 250
 * and 150 — 5.9 s at 500, 3.9 s at 250. Its other sites' files come from the kept ones (`staticCache.ts`) at once.
 */
export const PROJECT_QUIET_MS = 250;

/** How a page of the project is opened and settled: its quiet, and the requests `--hold` keeps unanswered left unwaited. */
export const projectSettling = (
  page: BrowserPage
): { quietMs: number; held: (request: { url(): string }) => boolean } => ({
  quietMs: PROJECT_QUIET_MS,
  held: heldOn(page)
});

/** The project each browser was launched for: where the pages it opens keep what other sites send them. */
const launchedFor = new WeakMap<Browser, string>();

/**
 * The project's `@playwright/test`'s Chromium, as its module exports it — or why there is none: what a browser is launched
 * by here, and the kept one (`keptBrowser.ts`) connected to.
 */
export const chromiumOf = async (root: string): Promise<{ chromium: Chromium } | { problem: string }> => {
  let loaded: unknown;
  try {
    const resolved = createRequire(path.join(root, 'package.json')).resolve('@playwright/test');
    // Its core, where it has one beside it: the browser alone, not the test runner around it — 20 ms of each command
    // that opens a page. Resolved from the runner's own place, as a package manager that hoists nothing keeps it.
    const core = (() => {
      try {
        return createRequire(resolved).resolve('playwright-core');
      } catch {
        return resolved;
      }
    })();
    loaded = await import(pathToFileURL(core).href);
  } catch {
    return { problem: 'This project has no @playwright/test installed: npm install -D @playwright/test' };
  }

  // Resolved as `require` resolves it, Playwright is its CommonJS entry: its exports arrive on the default one, which
  // is the `test` function — properties on a function, not a plain object.
  const chromium = [propertyOf(loaded, 'chromium'), propertyOf(propertyOf(loaded, 'default'), 'chromium')].find(
    isChromium
  );
  if (!isChromium(chromium)) {
    return { problem: 'The @playwright/test installed here has no Chromium to launch.' };
  }

  return { chromium };
};

/** The project's `@playwright/test`'s Chromium, launched — or why there is none. */
export const launchBrowser = async (root: string): Promise<Browser | { problem: string }> => {
  const loaded = await chromiumOf(root);
  if ('problem' in loaded) {
    return loaded;
  }

  try {
    const browser = await loaded.chromium.launch();
    launchedFor.set(browser, root);

    return browser;
  } catch (error) {
    return {
      problem: `Chromium did not start (${error instanceof Error ? error.message.split('\n')[0] : String(error)}): npx playwright install chromium`
    };
  }
};

/** What `npm start` wrote down when it took a port: the port, where it answers, and the name its `/health` answers with. */
const recorded = async (root: string): Promise<{ port?: number; url?: string; name?: string }> => {
  try {
    const value: unknown = JSON.parse(await readFile(path.join(root, DEV_SERVER_FILE), 'utf8'));
    if (!isRecord(value)) {
      return {};
    }

    return {
      ...(typeof value.port === 'number' ? { port: value.port } : {}),
      ...(typeof value.url === 'string' ? { url: value.url } : {}),
      ...(typeof value.name === 'string' ? { name: value.name } : {})
    };
  } catch {
    return {};
  }
};

/**
 * A server of this machine serving HTTPS: a project's own, with a certificate made for the browsers of its network
 * (mkcert) that nothing here was told to trust. What answers is checked by its name instead (`/health`).
 */
export const isLocalTls = (origin: string): boolean => {
  const { protocol, hostname } = new URL(origin);

  return protocol === 'https:' && ['127.0.0.1', 'localhost', '[::1]'].includes(hostname);
};

/** `/health`, read the way the tools read the pages: a local certificate taken as it is. */
export const readHealth = (origin: string): Promise<unknown> => {
  if (!isLocalTls(origin)) {
    return fetch(`${origin}/health`)
      .then(response => response.json())
      .catch(() => null);
  }

  return new Promise(resolve => {
    https
      .get(`${origin}/health`, { rejectUnauthorized: false }, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (body += chunk));
        response.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });
};

/**
 * An address given for the project's server (`--url`): the project served somewhere other than `npm start`'s port — a
 * second server of it, a staging deploy, the published site. Only where it answers: which page is the path argument's.
 */
export const givenOrigin = (url: string): { origin: string } | { problem: string } => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { problem: `--url takes where the server answers — https://staging.example.com — not "${url}".` };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { problem: `--url takes an http or https address, not ${parsed.protocol}` };
  }

  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    return {
      problem: `--url is only where the server answers; the page is the path: ${parsed.pathname}${parsed.search} --url ${parsed.origin}`
    };
  }

  return { origin: parsed.origin };
};

/**
 * Where the project's server answers: `--url` when it was given (see {@link givenOrigin}); else where `npm start` said it
 * does — scheme included, `https` for a project serving a certificate — on `PORT` when that is set, else the mode's
 * default; and, when `npm start` named itself, that what answers there is this project. Something else on the port answers too, with a page and a `200`, and a picture of the
 * wrong server looks like one of the right one.
 */
export const projectOrigin = async (
  root: string,
  project: PlitziProject | undefined,
  url?: string
): Promise<{ origin: string } | { problem: string }> => {
  if (url !== undefined) {
    return givenOrigin(url);
  }

  const server = await recorded(root);
  const where = new URL(server.url ?? 'http://127.0.0.1');
  where.port = String(process.env.PORT ?? server.port ?? (project?.mode === 'client' ? 5173 : 8080));
  const { origin, port } = where;
  // Vite has no /health: a client project that recorded no name is not asked one.
  if (project?.mode === 'client' && !server.name) {
    return { origin };
  }

  const health = await readHealth(origin);
  const answered = isRecord(health) && typeof health.Server === 'string' ? health.Server : '';
  // Which copy answers: a run's copies share the name, and a server whose port another copy held left that one there.
  const instance = isRecord(health) && typeof health.Instance === 'string' ? health.Instance : undefined;
  if (instance !== undefined && instance !== projectMark(root)) {
    return {
      problem: `Port ${port} answers with ${answered ? `"${answered}"` : 'a project'} served from another folder, not this one${process.env.PORT ? ` (PORT=${process.env.PORT})` : ''}: this project's own server is not on it. Start it on a free port — npm start without PORT takes the next free one and writes it to ${DEV_SERVER_FILE}, where this looks`
    };
  }

  // Nothing at all on the port: said before a page command reads "nothing answers" of every page — a folder made from the
  // run's work (`run preview --copy`) has no server until one is started in it.
  if (!isRecord(health)) {
    return {
      problem: `No Plitzi server answers on port ${port} for ${root}${server.port === undefined ? ' — no npm start of this folder recorded where it serves' : ` — where its last npm start served (${DEV_SERVER_FILE})`}. Start it here: npm start — wherever it serves, it writes it to ${DEV_SERVER_FILE} and this finds it`
    };
  }

  if (!server.name || answered === server.name) {
    return { origin };
  }

  return {
    problem: answered
      ? `Port ${port} answers as "${answered}", not this project ("${server.name}"). Start it: npm start`
      : `Nothing of this project answers on port ${port}${server.port !== undefined && process.env.PORT === undefined ? ` — where its last npm start served (${DEV_SERVER_FILE})` : ''}. Start it: npm start — wherever it serves, it writes it there and this finds it`
  };
};

/** A picture as a data URL, which is how a page in the browser is handed one to read. */
export const dataUrl = (png: Uint8Array): string => `data:image/png;base64,${Buffer.from(png).toString('base64')}`;

/** A data URL's picture back as bytes, to write to a file. */
export const fromDataUrl = (url: string): Buffer => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

export interface ProjectView {
  width: number;
  height: number;
  /** The space's theme, chosen as a visitor's toggle chooses it. Left out, the space's own default. */
  scheme?: Scheme;
  reducedMotion?: boolean;
  /**
   * Taking part in the page's channels as a visitor does: arriving, announcing itself, sending. Left out, the page only
   * watches them — `OBSERVER_COOKIE_NAME` — so a check is never somebody walking into a room people are in.
   */
  presence?: boolean;
  /** The visitor's time zone (IANA, `America/Mexico_City`): a page that writes the visitor's hour, read as theirs. */
  timezone?: string;
  /** Device pixels a CSS pixel (`page shot --scale`): the picture that many times as large, the layout the same. */
  scale?: number;
  /**
   * The browser where it is not a visitor's ordinary one — its clock held, a request failing, autoplay or storage refused
   * — applied here, as the page opens, for every command that reads a page alike.
   */
  conditions?: BrowserConditions;
}

/** What `page` asks other sites than `own` for, kept on disk for the project's next browsers (`staticCache.ts`). */
const keepOthers = async (browser: Browser, page: BrowserPage, own?: string): Promise<void> => {
  const root = launchedFor.get(browser);
  if (root !== undefined) {
    await keepStatic(page, staticCacheDir(root), own);
  }
};

/** Another site's page — a reference, a page to import — whose pictures, fonts and styles are kept for the next look. */
export const openOtherPage = async (
  browser: Browser,
  options: Parameters<Browser['newPage']>[0]
): Promise<BrowserPage> => {
  const page = await browser.newPage(options);
  await Promise.all([keepOthers(browser, page), withoutDevTools(page)]);

  return page;
};

/**
 * Another site's page in a context shared with others — the kept browser's, whose cache holds the site from the pages
 * read before — sized and in the media asked on the page alone: the other site loaded in a fraction of the time a new
 * context takes (0.6 s against 1.4–2.4).
 */
export const openOtherPageIn = async (
  browser: Browser,
  context: BrowserContext,
  view: { width: number; height: number; scheme?: Scheme; reducedMotion: boolean }
): Promise<BrowserPage> => {
  const page = await context.newPage();
  await Promise.all([
    page.setViewportSize({ width: view.width, height: view.height }),
    page.emulateMedia({
      colorScheme: view.scheme ?? 'light',
      reducedMotion: view.reducedMotion ? 'reduce' : 'no-preference'
    }),
    keepOthers(browser, page),
    withoutDevTools(page)
  ]);

  return page;
};

/**
 * A page for the project's own server, in the theme asked for. The machine's preference alone is not enough: a space
 * whose default is dark paints dark whatever the machine prefers, as it would for any visitor. So a scheme asked for
 * is also the space's own choice — the `theme` cookie a visitor's `themeToggle` writes and the server paints `<html>`
 * by — set before the page is asked for, so the first paint is already in it.
 */
export const openProjectPage = async (browser: Browser, origin: string, view: ProjectView): Promise<BrowserPage> => {
  const page = await browser.newPage({
    viewport: { width: view.width, height: view.height },
    colorScheme: view.scheme ?? 'light',
    reducedMotion: view.reducedMotion ? 'reduce' : 'no-preference',
    ignoreHTTPSErrors: isLocalTls(origin),
    ...(view.timezone ? { timezoneId: view.timezone } : {}),
    ...(view.scale ? { deviceScaleFactor: view.scale } : {})
  });
  await Promise.all([keepOthers(browser, page, origin), withoutDevTools(page)]);
  await page
    .context()
    .addCookies([
      ...(view.scheme ? [{ name: THEME_COOKIE_NAME, value: view.scheme, url: origin }] : []),
      ...(view.presence ? [] : [{ name: OBSERVER_COOKIE_NAME, value: '1', url: origin }])
    ]);
  if (view.conditions) {
    await applyConditions(page, view.conditions);
  }

  return page;
};

/**
 * The theme a page was painted in: the class on `<html>` (a space's own choice, or its default), else the one the
 * machine prefers — which is what a page with neither follows.
 */
export const paintedScheme = (page: BrowserPage, machine: Scheme): Promise<Scheme> =>
  page.evaluate((prefers: Scheme): Scheme => {
    const { classList } = document.documentElement;
    if (classList.contains('dark')) {
      return 'dark';
    }

    return classList.contains('light') ? 'light' : prefers;
  }, machine);

/**
 * The page as a visitor sees it: the dev tools' own chrome — the badge, the panel — left out of whatever is looked at,
 * from the document's first paint: never drawn, rather than drawn and taken away once the page has loaded, every style
 * of it computed again. Self-contained — it runs in the page, before any of its scripts.
 */
const hideDevToolsInPage = (css: string): void => {
  const add = (root: Element): void => {
    const style = document.createElement('style');
    style.textContent = css;
    root.appendChild(style);
  };
  // Read by query, which may find none: as an init script runs, the document can have no root yet — whatever the
  // types say of `documentElement`.
  const root = document.querySelector('html');
  if (root) {
    add(root);

    return;
  }

  new MutationObserver((_records, observer) => {
    const arrived = document.querySelector('html');
    if (arrived) {
      observer.disconnect();
      add(arrived);
    }
  }).observe(document, { childList: true });
};

const withoutDevTools = (page: BrowserPage): Promise<void> =>
  page.addInitScript(hideDevToolsInPage, HIDE_DEV_TOOLS_CSS);
