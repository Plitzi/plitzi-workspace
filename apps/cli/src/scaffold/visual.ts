import { runCommand } from './packageManager';

import type { CreateAnswers, ProjectFiles } from './types';

/**
 * A browser opens the page and checks it rendered.
 *
 * The smallest test that can fail for a real reason, and the reason it is generated rather than left to the owner:
 * a space renders through a stack — schema, style, plugins, hydration — where a mistake shows up as a blank page
 * rather than as an exception, and nobody writes the first test for a project that already looks fine.
 */

const playwrightConfig = ({
  mode,
  packageManager
}: CreateAnswers): string => `import { defineConfig } from '@playwright/test';

const PORT = ${mode === 'server' ? '8080' : '5173'};

export default defineConfig({
  testDir: './visual',
  outputDir: './visual/.results',
  use: { baseURL: \`http://127.0.0.1:\${PORT}\` },
  // Playwright starts the project itself, so \`${runCommand(packageManager, 'visual')}\` is one command from a
  // cold checkout.
  webServer: {
    command: '${runCommand(packageManager, 'start')}',
    url: \`http://127.0.0.1:\${PORT}\`,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
`;

const authoredSpec = (): string => `import { expect, test } from '@playwright/test';

import { authorSpace, inspectPage } from '@plitzi/sdk-authoring';

import { declarations } from '../src/plugins/declarations.ts';
import { space } from '../src/space.ts';

/**
 * Every page renders whole: everything the space NAMES is on screen, images arrived, nothing scrolls sideways, and no
 * text is drawn in the colour behind it.
 *
 * The strongest assertion available about a page you did not hand-write, and it costs no upkeep: an id an author
 * bothered to write down is an element somebody meant to point at, and \`authorSpace\` reports which those were.
 * Rename one and this fails at author time with a suggestion, rather than at test time with an empty locator.
 *
 * One test per page, so the second page you add is covered the moment it exists. What a bare visit cannot show is
 * left to tests of its own: a page behind a session or with a route param (\`post/{{slug}}\`). What shows only under a
 * condition, renders once per list row or has no box of its own, \`inspectPage\` sets aside by itself.
 */
const { handles } = authorSpace(space, { plugins: declarations });

const openable = Object.values(handles.pages).filter(
  pageHandle => pageHandle.accessLevel !== 'authenticated' && pageHandle.params.length === 0
);

for (const pageHandle of openable) {
  test(\`\${pageHandle.path} renders whole\`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(pageHandle.path, { waitUntil: 'networkidle' });

    // Every problem at once, each naming the element and why — which ancestor hid it, what overflowed.
    expect((await inspectPage(page, handles, { page: pageHandle.id })).problems).toEqual([]);
    expect(errors).toEqual([]);
  });
}
`;

const documentSpec = (): string => `import { expect, test } from '@playwright/test';

/**
 * The page renders, and renders quietly.
 *
 * Deliberately not asserting on particular copy: this space is yours to change, and a test that broke every time
 * you edited a heading would be deleted within a week. What it holds is the part that must never break — the
 * page produced something, and the browser reported nothing while doing it.
 *
 * Naming elements in the space (\`data-plitzi-el\`) is what lets this get specific; see the README.
 */
test('renders the space without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/', { waitUntil: 'networkidle' });

  // Every element the SDK renders carries its id, so this is "the space produced something", not "the div exists".
  await expect(page.locator('[data-plitzi-el]').first()).toBeVisible();
  expect(errors).toEqual([]);
});
`;

const shotScript = ({ mode }: CreateAnswers): string => `import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { chromium } from '@playwright/test';

/**
 * A screenshot of one page, to look at a change without writing a test for it.
 *
 *   npm run shot -- /about --width 390 --scheme dark
 *   npm run shot -- / --out shots/home.png --height 900
 *
 * The whole page, not one screen of it. The dev server has to be running (npm start).
 */
const PORT = ${mode === 'server' ? '8080' : '5173'};

const args = process.argv.slice(2);
const option = (name: string, fallback: string): string => {
  const index = args.indexOf('--' + name);

  return index === -1 ? fallback : (args[index + 1] ?? fallback);
};

const path = args.find(arg => arg.startsWith('/')) ?? '/';
const width = Number(option('width', '1280'));
const height = Number(option('height', '800'));
const scheme = option('scheme', 'light') === 'dark' ? 'dark' : 'light';
const name = path === '/' ? 'home' : path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
const out = option('out', 'visual/.shots/' + name + '-' + width + '-' + scheme + '.png');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
  const response = await page.goto('http://127.0.0.1:' + PORT + path, { waitUntil: 'networkidle' }).catch(() => null);
  if (!response) {
    throw new Error('Nothing answers on port ' + PORT + '. Start the project first: npm start');
  }

  await mkdir(dirname(out), { recursive: true });
  await page.screenshot({ path: out, fullPage: true });
  console.log(out);
} finally {
  await browser.close();
}
`;

export const visualFiles = (answers: CreateAnswers): ProjectFiles => ({
  'playwright.config.ts': playwrightConfig(answers),
  'scripts/shot.ts': shotScript(answers),
  'visual/home.spec.ts': answers.source === 'local' ? authoredSpec() : documentSpec()
});
