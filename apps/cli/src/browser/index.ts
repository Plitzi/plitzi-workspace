import { readFile } from 'node:fs/promises';
import https from 'node:https';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { HIDE_DEV_TOOLS_CSS } from '@plitzi/sdk-shared/devTools/chrome';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { OBSERVER_COOKIE_NAME } from '@plitzi/sdk-shared/realtime/topics';
import { THEME_COOKIE_NAME } from '@plitzi/sdk-shared/theme/themeCookie';

import { DEV_SERVER_FILE } from '../scaffold/paths';

import type { PlitziProject } from '../commands/existingProject';
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

export interface PageResponse {
  status(): number;
  url(): string;
}

/** One element of a page, as `shot --clip` and `--scroll-to` reach it, and `check --click` and `--fill` use it. */
export interface PageElement {
  screenshot(): Promise<Uint8Array>;
  scrollIntoViewIfNeeded(options?: { timeout: number }): Promise<void>;
  /** How many elements the selector finds: none is an element not on the page. */
  count(): Promise<number>;
  click(options: { timeout: number }): Promise<void>;
  /** The elements inside it the selector finds. */
  locator(selector: string): { first(): PageElement };
  /** A function run in the page on the element itself. */
  evaluate<R, A>(fn: (node: Element, input: A) => R, input: A): Promise<R>;
  fill(value: string, options: { timeout: number }): Promise<void>;
  setChecked(checked: boolean, options: { timeout: number }): Promise<void>;
  selectOption(value: string, options: { timeout: number }): Promise<unknown>;
}

export interface BrowserPage {
  goto(url: string, options: { waitUntil: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<unknown>;
  screenshot(options: { fullPage: boolean }): Promise<Uint8Array>;
  /** The first element the selector finds — Playwright's own, which scrolls whatever pane holds it into view. */
  locator(selector: string): { first(): PageElement };
  evaluate<R, A>(fn: (input: A) => R | Promise<R>, input: A): Promise<R>;
  waitForSelector(selector: string, options: { timeout: number }): Promise<unknown>;
  waitForTimeout(milliseconds: number): Promise<void>;
  /** The keyboard, as a person types on it: into whatever has the focus. */
  keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
  /** A stylesheet added to the page as it is now: what a capture leaves out or holds still. */
  addStyleTag(options: { content: string }): Promise<unknown>;
  /** The browser context the page lives in — its cookies, set before the page is asked for. */
  context(): { addCookies(cookies: { name: string; value: string; url: string }[]): Promise<void> };
  /** Where the page is now — after any redirect the server answered with. */
  url(): string;
  /** Requests made as the page would make them, sharing its context's cookies: a sign-in here signs the page in. */
  request: {
    post(
      url: string,
      options: { data: Record<string, string> }
    ): Promise<{ ok(): boolean; status(): number; text(): Promise<string> }>;
  };
  on(event: 'pageerror', listener: (error: Error) => void): unknown;
  on(event: 'console', listener: (message: PageMessage) => void): unknown;
  on(event: 'response', listener: (response: PageResponse) => void): unknown;
  /** What `openPage` follows the page's requests by, to know when it has settled. */
  on(event: SettlingEvent, listener: (request: SettlingRequest) => void): unknown;
  off(event: SettlingEvent, listener: (request: SettlingRequest) => void): unknown;
}

export interface Browser {
  newPage(options: {
    viewport: { width: number; height: number };
    colorScheme: Scheme;
    reducedMotion: 'reduce' | 'no-preference';
    ignoreHTTPSErrors?: boolean;
  }): Promise<BrowserPage>;
  close(): Promise<void>;
}

interface Chromium {
  launch(): Promise<Browser>;
}

const isChromium = (value: unknown): value is Chromium => isRecord(value) && typeof value.launch === 'function';

/** A property of an object or of a function, which a module's exports can be either of. */
const propertyOf = (value: unknown, key: string): unknown =>
  (typeof value === 'object' || typeof value === 'function') && value !== null ? Reflect.get(value, key) : undefined;

/** The project's `@playwright/test`'s Chromium, launched — or why there is none. */
export const launchBrowser = async (root: string): Promise<Browser | { problem: string }> => {
  let loaded: unknown;
  try {
    const resolved = createRequire(path.join(root, 'package.json')).resolve('@playwright/test');
    loaded = await import(pathToFileURL(resolved).href);
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

  try {
    return await chromium.launch();
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
const readHealth = (origin: string): Promise<unknown> => {
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
 * Where the project's server answers: where `npm start` said it does — scheme included, `https` for a project serving
 * a certificate — on `PORT` when that is set, else the mode's default; and, when `npm start` named itself, that what
 * answers there is this project. Something else on the port answers too, with a page and a `200`, and a picture of the
 * wrong server looks like one of the right one.
 */
export const projectOrigin = async (
  root: string,
  project: PlitziProject | undefined
): Promise<{ origin: string } | { problem: string }> => {
  const server = await recorded(root);
  const where = new URL(server.url ?? 'http://127.0.0.1');
  where.port = String(process.env.PORT ?? server.port ?? (project?.mode === 'client' ? 5173 : 8080));
  const { origin, port } = where;
  if (!server.name) {
    return { origin };
  }

  const health = await readHealth(origin);
  const answered = isRecord(health) && typeof health.Server === 'string' ? health.Server : '';
  if (answered !== server.name) {
    return {
      problem: answered
        ? `Port ${port} answers as "${answered}", not this project ("${server.name}"). Start it: npm start`
        : `Nothing of this project answers on port ${port}. Start it: npm start`
    };
  }

  return { origin };
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
}

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
    ignoreHTTPSErrors: isLocalTls(origin)
  });
  await page
    .context()
    .addCookies([
      ...(view.scheme ? [{ name: THEME_COOKIE_NAME, value: view.scheme, url: origin }] : []),
      ...(view.presence ? [] : [{ name: OBSERVER_COOKIE_NAME, value: '1', url: origin }])
    ]);

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

/** The page as a visitor sees it: the dev tools' own chrome — the badge, the panel — left out of whatever is looked at. */
export const withoutDevTools = (page: BrowserPage): Promise<unknown> =>
  page.addStyleTag({ content: HIDE_DEV_TOOLS_CSS });
