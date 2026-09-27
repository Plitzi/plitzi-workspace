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

const spec = (elements: PluginNames[]): string => `import { expect, test } from '@playwright/test';

import { authorSpace, inspectPage } from '@plitzi/sdk-authoring';

import { space } from '../preview/space.ts';
import { declarations } from '../src/declarations.ts';

/** The preview's elements, by the id the preview space gives each and the label it shows. */
const ELEMENTS = [
${elements.map(({ base, title }) => `  { id: '${base}', label: ${tsString(title)} }`).join(',\n')}
];

/**
 * Each element, in the preview's space: on screen and answering a click.
 *
 * Found by its element id, which is what \`RootElement\` writes on it — so this also fails if a component stops
 * rendering its root through \`RootElement\`, the mistake that leaves a plugin looking right and being unreachable.
 */
for (const { id, label } of ELEMENTS) {
  test(\`\${id} renders in a space, and counts\`, async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const element = page.locator(\`[data-plitzi-el="\${id}"]\`);
    await expect(element).toBeVisible();
    await expect(element).toContainText(label);

    await expect(element.getByRole('status')).toHaveText('0');
    await element.getByRole('button').click();
    await expect(element.getByRole('status')).toHaveText('1');
  });
}

/**
 * The rest of the page too: an element that overflows or hides its neighbours is a page problem. And the space says
 * nothing it would have to be told twice — authoring knows the package's types for plugins, not typos.
 */
test('leaves the page whole', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/', { waitUntil: 'networkidle' });

  const { handles, warnings } = authorSpace(space, { pluginTypes: declarations.map(declaration => declaration.type) });
  expect(warnings).toEqual([]);
  expect((await inspectPage(page, handles)).problems).toEqual([]);
  expect(errors).toEqual([]);
});
`;

export const visualFiles = (elements: PluginNames[], answers: PluginAnswers): ProjectFiles => ({
  'playwright.config.ts': playwrightConfig(answers),
  'visual/plugin.spec.ts': spec(elements)
});
