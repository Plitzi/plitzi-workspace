import { describeTarget, expect, test } from '../../fixtures';
import { expectSharedSpace } from '../../helpers/sharedSpace';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';

const PREVIEW_SECRET = 'example-secret';

describeTarget('ssr-preview', subject => {
  test('serves ordinary pages alongside the agent surface', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSharedSpace(page);
    await expectVisuallyHealthy(page);

    await capture('pages');
  });

  test('renders an unsaved edit, once, and leaves the space alone', async ({ page, request }) => {
    const minted = await request.post(`${subject.origin}/__preview`, {
      headers: { 'content-type': 'application/json', 'x-preview-secret': PREVIEW_SECRET },
      data: { spaceId: 1, operations: [{ type: 'patchSettings', settings: { title: 'Draft title' } }] }
    });

    expect(minted.status()).toBe(200);

    const { token } = (await minted.json()) as { token: string };
    expect(token, 'preview returned no token').toBeTruthy();

    await page.goto(`${subject.origin}/?__pt=${token}`);
    await expect(page).toHaveTitle('Draft title');

    // One-shot: the same token again is spent, and what comes back is the space as it is actually stored.
    await page.goto(`${subject.origin}/?__pt=${token}`);
    await expect(page).not.toHaveTitle('Draft title');

    await expectSharedSpace(page);
  });

  test('refuses a preview without the secret', async ({ request }) => {
    const response = await request.post(`${subject.origin}/__preview`, {
      headers: { 'content-type': 'application/json' },
      data: { spaceId: 1, operations: [] }
    });

    expect(response.status(), 'preview minted a draft for an unauthenticated caller').toBeGreaterThanOrEqual(400);
  });

  test('answers MCP under /mcp without shadowing the pages', async ({ request }) => {
    const response = await request.post(`${subject.origin}/mcp`, {
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'plitzi-e2e', version: '0.0.0' }
        }
      }
    });

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('protocolVersion');
  });
});
