import { tsString } from './quote';
import { runCommand } from '../packageManager';

import type { PluginNames } from './names';
import type { PluginAnswers, ProjectFiles } from '../types';

/**
 * A browser opens the preview and checks the plugin works in a space: that it is there, and that it does what it says.
 *
 * What goes wrong with a plugin rarely throws. The element renders "Custom Component … Not Found", or renders and
 * cannot be clicked, or hydrates blank — and the preview looks fine to somebody who did not scroll to it.
 */

const playwrightConfig = ({
  packageManager
}: PluginAnswers): string => `import { defineConfig } from '@playwright/test';

const PORT = 5173;

export default defineConfig({
  testDir: './visual',
  outputDir: './visual/.results',
  use: { baseURL: \`http://127.0.0.1:\${PORT}\` },
  // Playwright starts the preview itself, so \`${runCommand(packageManager, 'visual')}\` is one command from a cold checkout.
  webServer: {
    command: '${runCommand(packageManager, 'start')}',
    url: \`http://127.0.0.1:\${PORT}\`,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
`;

const spec = ({ base, title }: PluginNames): string => `import { expect, test } from '@playwright/test';

import { authorSpace, inspectPage } from '@plitzi/sdk-authoring';

import { space } from '../preview/space.ts';
import { declarations } from '../src/declarations.ts';

/**
 * The plugin, in the preview's space: on screen, whole, and answering a click.
 *
 * Found by its element id, which is what \`RootElement\` writes on it — so this also fails if the component stops
 * rendering its root through \`RootElement\`, the mistake that leaves a plugin looking right and being unreachable.
 */
test('renders in a space, and counts', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/', { waitUntil: 'networkidle' });

  const element = page.locator('[data-plitzi-el="${base}"]');
  await expect(element).toBeVisible();
  await expect(element).toContainText(${tsString(title)});

  await expect(element.getByRole('status')).toHaveText('0');
  await element.getByRole('button').click();
  await expect(element.getByRole('status')).toHaveText('1');

  // The rest of the page too: a plugin that overflows or hides its neighbours is a page problem. And the space says
  // nothing it would have to be told twice — authoring knows the package's types for plugins, not typos.
  const { handles, warnings } = authorSpace(space, { pluginTypes: declarations.map(declaration => declaration.type) });
  expect(warnings).toEqual([]);
  expect((await inspectPage(page, handles)).problems).toEqual([]);
  expect(errors).toEqual([]);
});
`;

export const visualFiles = (names: PluginNames, answers: PluginAnswers): ProjectFiles => ({
  'playwright.config.ts': playwrightConfig(answers),
  'visual/plugin.spec.ts': spec(names)
});
