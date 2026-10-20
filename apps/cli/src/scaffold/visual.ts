import { runCommand } from './packageManager';
import { DEV_SERVER_FILE, SERVER_RECORD_ENV, VISUAL_OUTPUT } from './paths';

import type { CreateAnswers, ProjectFiles } from './types';

/**
 * A browser opens the page and checks it rendered.
 *
 * The smallest test that can fail for a real reason, and the reason it is generated rather than left to the owner:
 * a space renders through a stack — schema, style, plugins, hydration — where a mistake shows up as a blank page
 * rather than as an exception, and nobody writes the first test for a project that already looks fine.
 */

/**
 * The port the suite's own server takes: none of the project's other scripts' — \`start\` (8080, Vite's 5173), the run's
 * preview (8300, a task's 8301), the inspector (9229) — so \`visual\` never reuses, nor lands on, a server a person
 * or a run is using.
 */
const TEST_PORT: Record<CreateAnswers['mode'], number> = { server: 8400, client: 5273 };

const playwrightConfig = ({
  mode,
  packageManager
}: CreateAnswers): string => `import { defineConfig } from '@playwright/test';

// \`PORT\` when set (a run's check sets it); otherwise the suite's own, which no other script of the project takes.
const PORT = Number(process.env.PORT ?? ${String(TEST_PORT[mode])});
const ORIGIN = \`http://127.0.0.1:\${String(PORT)}\`;

export default defineConfig({
  testDir: './visual',
  outputDir: './${VISUAL_OUTPUT}',
  use: { baseURL: ORIGIN },
  // Playwright starts the project itself, on a port of its own, so \`${runCommand(packageManager, 'visual')}\` is one
  // command from a cold checkout and never runs against the server you have open. Plain HTTP whatever \`.env\` says
  // (TLS_CERT is for a device on the Wi-Fi), and its record kept apart: \`${DEV_SERVER_FILE}\` stays yours.
  webServer: {
    command: '${runCommand(packageManager, 'start')}',
    url: ORIGIN,
    env: { PORT: String(PORT), TLS_CERT: '', TLS_KEY: '', ${SERVER_RECORD_ENV}: '${VISUAL_OUTPUT}/server.json' },
    reuseExistingServer: true,
    timeout: 120_000
  }
});
`;

const authoredSpec = (): string => `import { expect, test } from '@playwright/test';

import { inspectPage, openPage } from '@plitzi/sdk-authoring';
import { authorProjectSpace } from '@plitzi/sdk-authoring/node';

/**
 * Every page renders whole: everything the space NAMES is on screen, images arrived, nothing scrolls sideways, and no
 * text is drawn in the colour behind it.
 *
 * The strongest assertion available about a page you did not hand-write, and it costs no upkeep: an id an author
 * bothered to write down is an element somebody meant to point at, and \`authorSpace\` reports which those were.
 * Rename one and this fails at author time with a suggestion, rather than at test time with an empty locator.
 *
 * One test per page, so the second page you add is covered the moment it exists. What a bare visit cannot show is
 * left to tests of its own: a page behind a session or a permission (\`access\`), or with a route param
 * (\`post/{{slug}}\`). What shows only under a condition, renders once per list row or has no box of its own,
 * \`inspectPage\` sets aside by itself.
 */
const { handles } = await authorProjectSpace();

const openable = Object.values(handles.pages).filter(
  pageHandle =>
    pageHandle.accessLevel !== 'authenticated' && pageHandle.access === undefined && pageHandle.params.length === 0
);

for (const pageHandle of openable) {
  test(\`\${pageHandle.path} renders whole\`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    // Settled, not \`networkidle\`: a page with a live channel keeps its stream open, and never idles.
    await openPage(page, pageHandle.path);

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

  // \`load\`, not \`networkidle\`: a page with a live channel keeps its stream open and never idles — the assertion below
  // waits for what it needs.
  await page.goto('/', { waitUntil: 'load' });

  // Every element the SDK renders carries its id, so this is "the space produced something", not "the div exists".
  await expect(page.locator('[data-plitzi-el]').first()).toBeVisible();
  expect(errors).toEqual([]);
});
`;

export const visualFiles = (answers: CreateAnswers): ProjectFiles => ({
  'playwright.config.ts': playwrightConfig(answers),
  'visual/home.spec.ts': answers.source === 'local' ? authoredSpec() : documentSpec()
});
