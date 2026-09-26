import crypto from 'node:crypto';

import { describeTarget, expect, test } from '../../../fixtures';

/** What a page reads of the manifest before it loads anything. */
type Manifest = {
  root: string;
  pluginSchema: Record<string, { definition: { type: string; description?: string } }>;
  assets: Record<string, { src: string; type: string; integrity: string; isMain: boolean }>;
};

describeTarget('plugin-server', subject => {
  /** Where the plugin is published: its own origin, as a CDN is — see `server/pluginServer.ts`. */
  const host = subject.origin.replace(/:(\d+)$/, (_match, port: string) => `:${Number(port) + 100}`);

  test('publishes a manifest naming its type and the one file a page loads, with the hash that file has', async ({
    request
  }) => {
    const manifest = (await (await request.get(`${host}/plugin-manifest.json`)).json()) as Manifest;

    expect(manifest.root).toBe('seatPicker');
    expect(manifest.pluginSchema.seatPicker.definition).toMatchObject({
      type: 'seatPicker',
      description: 'Counts seats.'
    });
    expect(Object.keys(manifest.assets)).toEqual(['seat-picker.mjs']);

    const file = await (await request.get(`${host}/seat-picker.mjs`)).body();
    const hash = crypto.createHash('sha384').update(file).digest('base64');
    expect(manifest.assets['seat-picker.mjs']).toMatchObject({
      type: 'script',
      isMain: true,
      integrity: `sha384-${hash}`
    });

    // The page's React and SDK, imported rather than carried: a second copy is "Invalid hook call" and a blank element.
    const code = file.toString('utf-8');
    expect(code).toMatch(/from\s*"react"/);
    expect(code).toMatch(/from\s*"@plitzi\/plitzi-sdk"/);
  });

  test('renders in a page that loads it from its manifest, and does what it declares', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(subject.origin, { waitUntil: 'networkidle' });

    const element = page.locator('[data-plitzi-el="seat-picker"]');
    await expect(element).toContainText('Seat Picker');
    await expect(element.getByRole('status')).toHaveText('0');
    await element.getByRole('button').click();
    await expect(element.getByRole('status')).toHaveText('1');
    expect(errors).toEqual([]);
  });
});
