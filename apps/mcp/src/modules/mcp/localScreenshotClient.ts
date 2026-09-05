import { PREVIEW_TOKEN_PARAM } from '@plitzi/sdk-server/kernel';

import type { ScreenshotClient, ScreenshotImage, ScreenshotInput, ScreenshotResult } from './types';

/**
 * A capture that needs no service to be running.
 *
 * The HTTP client beside this one talks to a dedicated browser pod, which is the right answer in a cluster: the SSR
 * and MCP images stay small, and the one workload carrying Chromium is separate and disposable. It is the wrong
 * answer for everybody else. Somebody self-hosting `@plitzi/sdk-server` who wants to look at what they just changed
 * had to stand up a second service first, and the loop that was supposed to take a second took an afternoon.
 *
 * So the browser is resolved at RUN time from whatever the host already has — Playwright, then Puppeteer — and the
 * whole thing is absent when it has neither. Nothing is added to this package's dependency tree, nothing is
 * downloaded on install, and a deployment that never captures anything never loads a line of it.
 */

/** The narrow slice of a browser driver this uses. Both drivers satisfy it; neither is imported at build time. */
type Page = {
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
  setViewportSize?: (size: { width: number; height: number }) => Promise<void>;
  setViewport?: (size: { width: number; height: number }) => Promise<void>;
  evaluate: <T>(fn: () => T) => Promise<T>;
  screenshot: (options: Record<string, unknown>) => Promise<Buffer | Uint8Array>;
};

type Browser = {
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
};

type Launcher = { launch: (options?: Record<string, unknown>) => Promise<Browser> };

/**
 * Grow the window to whatever actually scrolls before shooting.
 *
 * The SDK renders into `.plitzi-sdk` with an inner `overflow: auto` column, so the DOCUMENT never scrolls and a
 * driver's `fullPage` has nothing to extend — it returns exactly one viewport of a page that may be ten. The height
 * has to come from the scrolling descendant, and the window has to be made that tall before the shot.
 */
const CONTENT_HEIGHT = (): number => {
  const scrollers = [...document.querySelectorAll<HTMLElement>('*')].filter(
    element => element.scrollHeight > element.clientHeight + 1 && element.clientHeight > 0
  );

  return Math.max(document.documentElement.scrollHeight, ...scrollers.map(element => element.scrollHeight));
};

/** Guard against a runaway page turning one screenshot into a hundred-megabyte PNG. */
const MAX_HEIGHT = 8000;

const importDriver = async (name: string): Promise<Launcher | undefined> => {
  try {
    // A variable specifier, so a bundler cannot decide this package depends on either driver.
    const module = (await import(/* @vite-ignore */ name)) as { chromium?: Launcher; default?: Launcher };

    // Playwright exports the browser as `chromium`; Puppeteer's default export is the launcher itself.
    return module.chromium ?? module.default;
  } catch {
    return undefined;
  }
};

/** Which driver this host has, if any. Playwright first: it is what the visual suites already install. */
export const resolveLocalBrowser = async (): Promise<Launcher | undefined> =>
  (await importDriver('playwright')) ?? (await importDriver('puppeteer'));

export type LocalScreenshotClientConfig = {
  /** SSR base the browser navigates to; the page path and the preview token are appended. */
  renderBaseUrl: string;
  /** A dev certificate is signed by a local CA no browser has a reason to know about. */
  ignoreHttpsErrors?: boolean;
};

const setViewport = async (page: Page, size: { width: number; height: number }): Promise<void> => {
  await (page.setViewportSize ? page.setViewportSize(size) : page.setViewport?.(size));
};

/**
 * A `ScreenshotClient` backed by a browser on this machine, or `undefined` when there is none.
 *
 * Undefined rather than a client that fails on every call: "no browser here" is a fact about the deployment that
 * whoever wires the tools should act on once — by not offering the tool — instead of a failure every caller has to
 * interpret. It is the same shape the HTTP client returns, so the two are interchangeable at the call site.
 */
export const createLocalScreenshotClient = async ({
  renderBaseUrl,
  ignoreHttpsErrors = true
}: LocalScreenshotClientConfig): Promise<ScreenshotClient | undefined> => {
  const driver = await resolveLocalBrowser();
  if (!driver) {
    return undefined;
  }

  return {
    async capture({ pagePath, token, viewports, fullPage = true }: ScreenshotInput): Promise<ScreenshotResult> {
      const url = new URL(pagePath, renderBaseUrl);
      if (token) {
        url.searchParams.set(PREVIEW_TOKEN_PARAM, token);
      }

      /**
       * One browser per capture, closed in `finally`.
       *
       * A pooled instance would save a second per call and cost a process that outlives every request, a page that
       * leaks when a capture throws, and a crashed browser that every later call inherits. This runs while somebody
       * is waiting for one picture, so the second is worth not owning any of that.
       */
      let browser: Browser | undefined;
      try {
        browser = await driver.launch({
          args: ['--no-sandbox'],
          ...(ignoreHttpsErrors ? { ignoreHTTPSErrors: true } : {})
        });
        const images: ScreenshotImage[] = [];

        for (const viewport of viewports) {
          const page = await browser.newPage();
          await setViewport(page, viewport);
          await page.goto(url.toString(), { waitUntil: 'networkidle0' });

          if (fullPage) {
            const height = Math.min(await page.evaluate(CONTENT_HEIGHT), MAX_HEIGHT);
            if (height > viewport.height) {
              await setViewport(page, { width: viewport.width, height });
            }
          }

          const shot = await page.screenshot({ type: 'png', fullPage });
          images.push({ label: viewport.label, mimeType: 'image/png', data: Buffer.from(shot).toString('base64') });
        }

        return { ok: true, images };
      } catch (err) {
        return { ok: false, error: 'SCREENSHOT_FAILED', message: `Local browser capture failed: ${String(err)}` };
      } finally {
        await browser?.close();
      }
    }
  };
};
