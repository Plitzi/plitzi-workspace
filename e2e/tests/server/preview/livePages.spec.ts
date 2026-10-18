import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createAuthoringHost, unusedPort } from '@plitzi/sdk-server';

import { expect, test } from '../../../fixtures';
import { liveSpace } from '../../../spaces';

import type { AuthoringHost } from '@plitzi/sdk-server';

/**
 * A page an agent keeps improving, seen to grow: `put` again under the id an open page shows, and the page takes the
 * new version where it stands — what the person did there kept, nothing loaded again. Only a browser can say so: the
 * swap is the SDK's, the stream the server's, and a reload would pass every assertion on the server alone.
 */
test.describe('live pages', () => {
  let host: AuthoringHost;
  let base = '';
  const dir = mkdtempSync(path.join(tmpdir(), 'plitzi-e2e-live-'));

  test.beforeAll(async () => {
    const port = await unusedPort();
    host = createAuthoringHost({ dir, port });
    await host.server.listen(port, '127.0.0.1');
    base = `http://127.0.0.1:${String(port)}`;
  });

  test.afterAll(async () => {
    await host.server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  test('an open page takes the next version where it stands, keeping what was done on it', async ({ page, step }) => {
    const { path: address } = host.put(liveSpace(1), { id: 'growing' });
    await page.goto(`${base}${address}`);

    await step('the first version, pressed', async () => {
      await expect(page.getByText('Version 1')).toBeVisible();
      await page.getByRole('button', { name: 'Press' }).click();
      await expect(page.getByText('pressed before the update')).toBeVisible();
    });

    // A reload would forget this; a swap in place does not.
    await page.evaluate(() => Object.assign(window, { __sameDocument: true }));

    await step('the second version, swapped in', async () => {
      // Until the page's stream is open, nobody is listening: put again until it says one page took it.
      await expect.poll(() => host.put(liveSpace(2), { id: 'growing' }).updated).toBe(1);
      await expect(page.getByText('Version 2')).toBeVisible();
      await expect(page.getByText('pressed before the update')).toBeVisible();
    });

    expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true);
  });
});
