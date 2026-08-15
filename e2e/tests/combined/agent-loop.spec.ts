import { expect, test } from '../../fixtures';
import { mintPreview, previewUrl } from '../../helpers/preview';
import { SAMPLE_IDS } from '../../spaces';
import { target } from '../../targets';

/** The whole loop an agent works in, end to end and across three surfaces: it connects over MCP, proposes an edit,
 *  the edit is rendered without being saved, and a person looks at the result in a browser.
 *
 *  Each surface has its own category and each passes on its own. This is the one that fails when the token minted
 *  by one package is not the token the other package accepts — the seam, which is where this repo actually
 *  breaks. */
test.describe('an agent edit reaching a page', () => {
  test('connect, propose, preview, look', async ({ page, request, capture }) => {
    const { origin } = target('server');

    const handshake = await request.post(`${origin}/mcp`, {
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

    expect(handshake.status(), 'the agent could not connect').toBe(200);

    const token = await mintPreview(request, origin, [
      {
        type: 'patchElement',
        pageRef: SAMPLE_IDS.page,
        ref: SAMPLE_IDS.mainHeading,
        props: { content: 'What the agent proposed' }
      }
    ]);

    await page.goto(previewUrl(origin, token));

    await expect(page.getByRole('heading', { name: 'What the agent proposed' })).toBeVisible();
    // Still a real page: the draft replaced one element, not the render.
    await expect(page.getByRole('heading', { name: 'Docs', exact: true })).toBeVisible();
    await expect(page.locator('[data-probe="server"]')).toBeVisible();

    await capture('proposed-edit');

    await page.goto(origin);
    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();
  });
});
