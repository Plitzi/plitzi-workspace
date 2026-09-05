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

import { authorSpace, locate } from '@plitzi/sdk-authoring';

import { space } from '../src/space';

/**
 * Everything this space NAMES is on screen.
 *
 * The strongest assertion available about a page you did not hand-write, and it costs no upkeep: an id an author
 * bothered to write down is an element somebody meant to point at, and \`authorSpace\` reports which those were.
 * Rename one and this fails at author time with a suggestion, rather than at test time with an empty locator.
 */
const { handles } = authorSpace(space);

test('renders every element it names', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/', { waitUntil: 'networkidle' });
  const el = locate(page, handles);

  for (const handle of Object.values(handles.page('').elements).filter(entry => entry.named)) {
    await expect(el(handle.id), \`\${handle.type} "\${handle.id}"\`).toBeVisible();
  }

  expect(errors).toEqual([]);
});
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

export const visualFiles = (answers: CreateAnswers): ProjectFiles => ({
  'playwright.config.ts': playwrightConfig(answers),
  'visual/home.spec.ts': answers.source === 'local' ? authoredSpec() : documentSpec()
});
