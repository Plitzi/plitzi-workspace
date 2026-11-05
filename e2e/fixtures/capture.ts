import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import type { Page, TestInfo } from '@playwright/test';

/** Screenshots go somewhere a human — or an agent reading the repo — can find without opening the HTML report:
 *  `e2e/.artifacts/screenshots/<project>/<spec>--<name>.png`, one predictable path per capture. */
const SCREENSHOTS_DIR = path.resolve(import.meta.dirname, '../.artifacts/screenshots');

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export type Capture = (name: string, target?: Page) => Promise<string>;

export const createCapture = async (page: Page, testInfo: TestInfo): Promise<Capture> => {
  const dir = path.join(SCREENSHOTS_DIR, testInfo.project.name);
  await mkdir(dir, { recursive: true });

  return async (name, target = page) => {
    const file = path.join(dir, `${slug(testInfo.title)}--${slug(name)}.png`);
    // `caret: 'initial'`: Playwright's default writes `caret-color: transparent` on every input, and a page still
    // hydrating — a step's capture right after a navigation — reports that as a hydration mismatch it never had.
    await target.screenshot({ path: file, fullPage: true, caret: 'initial' });
    await testInfo.attach(name, { path: file, contentType: 'image/png' });

    return file;
  };
};
