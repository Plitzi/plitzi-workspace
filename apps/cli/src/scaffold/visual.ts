import { runCommand } from './packageManager';
import { DEV_SERVER_FILE, VISUAL_OUTPUT } from './paths';

import type { CreateAnswers, ProjectFiles } from './types';

/**
 * A browser opens the page and checks it rendered.
 *
 * The smallest test that can fail for a real reason, and the reason it is generated rather than left to the owner:
 * a space renders through a stack — schema, style, plugins, hydration — where a mistake shows up as a blank page
 * rather than as an exception, and nobody writes the first test for a project that already looks fine.
 */

const RECORDED = `/** What \`npm start\` wrote down when it took a port: the port, and the name its \`/health\` answers with. */
const recorded = (): { port?: number; name?: string } => {
  try {
    const value: unknown = JSON.parse(readFileSync('${DEV_SERVER_FILE}', 'utf8'));
    if (typeof value !== 'object' || value === null) {
      return {};
    }

    return {
      ...('port' in value && typeof value.port === 'number' ? { port: value.port } : {}),
      ...('name' in value && typeof value.name === 'string' ? { name: value.name } : {})
    };
  } catch {
    return {};
  }
};`;

const playwrightConfig = ({ mode, packageManager }: CreateAnswers): string => `import { readFileSync } from 'node:fs';

import { defineConfig } from '@playwright/test';

${RECORDED}

// \`PORT\` when set; otherwise the port \`npm start\` took; otherwise the default.
const PORT = Number(process.env.PORT ?? recorded().port ?? ${mode === 'server' ? '8080' : '5173'});

export default defineConfig({
  testDir: './visual',
  outputDir: './${VISUAL_OUTPUT}',
  use: { baseURL: \`http://127.0.0.1:\${PORT}\` },
  // Playwright starts the project itself, so \`${runCommand(packageManager, 'visual')}\` is one command from a
  // cold checkout.
  webServer: {
    command: '${runCommand(packageManager, 'start')}',
    url: \`http://127.0.0.1:\${PORT}\`,
    env: { PORT: String(PORT) },
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
 * left to tests of its own: a page behind a session or with a route param (\`post/{{slug}}\`). What shows only under a
 * condition, renders once per list row or has no box of its own, \`inspectPage\` sets aside by itself.
 */
const { handles } = await authorProjectSpace();

const openable = Object.values(handles.pages).filter(
  pageHandle => pageHandle.accessLevel !== 'authenticated' && pageHandle.params.length === 0
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
