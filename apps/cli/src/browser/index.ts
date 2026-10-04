import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import type { PlitziProject } from '../commands/existingProject';

/**
 * A browser on the project's own Playwright, and the project's own server to point it at — what `plitzi check`,
 * `plitzi shot` and `plitzi import` look at a page with (`import` at a site of the person's, not the project's server).
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
}

export interface PageResponse {
  status(): number;
  url(): string;
}

/** One element of a page, as `shot --clip` and `--scroll-to` reach it. */
export interface PageElement {
  screenshot(): Promise<Uint8Array>;
  scrollIntoViewIfNeeded(): Promise<void>;
}

export interface BrowserPage {
  goto(url: string, options: { waitUntil: 'load' | 'networkidle' }): Promise<unknown>;
  screenshot(options: { fullPage: boolean }): Promise<Uint8Array>;
  /** The first element the selector finds — Playwright's own, which scrolls whatever pane holds it into view. */
  locator(selector: string): { first(): PageElement };
  evaluate<R, A>(fn: (input: A) => R | Promise<R>, input: A): Promise<R>;
  waitForSelector(selector: string, options: { timeout: number }): Promise<unknown>;
  waitForTimeout(milliseconds: number): Promise<void>;
  on(event: 'pageerror', listener: (error: Error) => void): unknown;
  on(event: 'console', listener: (message: PageMessage) => void): unknown;
  on(event: 'response', listener: (response: PageResponse) => void): unknown;
}

export interface Browser {
  newPage(options: {
    viewport: { width: number; height: number };
    colorScheme: Scheme;
    reducedMotion: 'reduce' | 'no-preference';
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

/** What `npm start` wrote down when it took a port: the port, and the name its `/health` answers with. */
const recorded = async (root: string): Promise<{ port?: number; name?: string }> => {
  try {
    const value: unknown = JSON.parse(await readFile(path.join(root, '.plitzi/dev-server.json'), 'utf8'));
    if (!isRecord(value)) {
      return {};
    }

    return {
      ...(typeof value.port === 'number' ? { port: value.port } : {}),
      ...(typeof value.name === 'string' ? { name: value.name } : {})
    };
  } catch {
    return {};
  }
};

/**
 * Where the project's server answers: `PORT` when set, the port `npm start` took otherwise, else the mode's default —
 * and, when `npm start` named itself, that what answers there is this project. Something else on the port answers too,
 * with a page and a `200`, and a picture of the wrong server looks like one of the right one.
 */
export const projectOrigin = async (
  root: string,
  project: PlitziProject | undefined
): Promise<{ origin: string } | { problem: string }> => {
  const server = await recorded(root);
  const port = Number(process.env.PORT ?? server.port ?? (project?.mode === 'client' ? 5173 : 8080));
  const origin = `http://127.0.0.1:${String(port)}`;
  if (!server.name) {
    return { origin };
  }

  const health: unknown = await fetch(`${origin}/health`)
    .then(response => response.json())
    .catch(() => null);
  const answered = isRecord(health) && typeof health.Server === 'string' ? health.Server : '';
  if (answered !== server.name) {
    return {
      problem: answered
        ? `Port ${String(port)} answers as "${answered}", not this project ("${server.name}"). Start it: npm start`
        : `Nothing of this project answers on port ${String(port)}. Start it: npm start`
    };
  }

  return { origin };
};

/** A picture as a data URL, which is how a page in the browser is handed one to read. */
export const dataUrl = (png: Uint8Array): string => `data:image/png;base64,${Buffer.from(png).toString('base64')}`;

/** A data URL's picture back as bytes, to write to a file. */
export const fromDataUrl = (url: string): Buffer => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
