import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RENDER_APP_URI } from '../apps';
import { memoryStorage, readAppPage, startMcpEndpoint, startRenderingHost } from './index';

import type { McpEndpoint } from './index';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** The half a wire test cannot reach: the served ui:// page actually RUNNING, fetched from the live endpoint and
 *  driven through the official AppBridge. If these pass, only the host's own chrome stands between the widget
 *  and a user. */

const HANDSHAKE_TIMEOUT = 60_000;

const callRender = (endpoint: McpEndpoint, operations: unknown[]): Promise<CallToolResult> =>
  endpoint.client.callTool({ name: 'plitzi_render', arguments: { operations } }) as Promise<CallToolResult>;

const callPatch = (endpoint: McpEndpoint, renderId: string, content: string): Promise<CallToolResult> =>
  endpoint.client.callTool({
    name: 'plitzi_render',
    arguments: {
      patch: true,
      renderId,
      operations: [{ type: 'patchElement', pageRef: 'render', ref: 'greeting', props: { content } }]
    }
  }) as Promise<CallToolResult>;

const renderIdOf = (result: CallToolResult): string => (result.structuredContent as { renderId: string }).renderId;

const widget = (content: string) => [
  { type: 'upsertDefinition', ref: 'headline', desktop: { 'font-size': '32px', color: '#3b82f6' } },
  {
    type: 'upsertElement',
    pageRef: 'render',
    element: {
      ref: 'greeting',
      type: 'heading',
      subType: 'h1',
      props: { content },
      style: { base: ['headline'] }
    }
  }
];

describe('MCP Apps host (the ui:// page running against a real AppBridge)', () => {
  let endpoint: McpEndpoint;
  let page: string;

  beforeAll(async () => {
    endpoint = await startMcpEndpoint();
    page = (await readAppPage(endpoint, RENDER_APP_URI)).html;
  }, HANDSHAKE_TIMEOUT);

  afterAll(async () => {
    await endpoint.close();
  });

  it(
    'completes the ui/initialize handshake and identifies itself to the host',
    async () => {
      const host = await startRenderingHost(page);

      // An App that never completes the handshake reports nothing here.
      expect(host.bridge.getAppVersion()).toEqual({ name: 'Plitzi Widget', version: '1.0.0' });
      host.close();
    },
    HANDSHAKE_TIMEOUT
  );

  it(
    'paints the authored widget when the host pushes the tool result',
    async () => {
      const result = await callRender(endpoint, widget('Hello from plitzi_render'));
      const host = await startRenderingHost(page);

      await host.showResult(result);

      expect(host.text()).toContain('Hello from plitzi_render');
      // Authored as an h1: the subType survived the round trip into real DOM.
      expect(host.window.document.querySelector('h1')?.textContent).toBe('Hello from plitzi_render');
      host.close();
    },
    HANDSHAKE_TIMEOUT
  );

  // The widget is a panel inside someone else's chat, not a Plitzi site: the SDK's "Made in Plitzi" link would sit
  // fixed over the host's own UI, so this render turns it off.
  it(
    'paints the widget alone, with no Plitzi badge over the host chrome',
    async () => {
      const result = await callRender(endpoint, widget('No badge here'));
      const host = await startRenderingHost(page);

      await host.showResult(result);

      expect(host.text()).toContain('No badge here');
      expect(host.text()).not.toContain('Made in Plitzi');
      expect(host.window.document.querySelector('.made-in-plitzi')).toBeNull();
      host.close();
    },
    HANDSHAKE_TIMEOUT
  );

  it(
    'shows nothing until the result arrives, so a host never renders a half-built widget',
    async () => {
      const host = await startRenderingHost(page);

      expect(host.text()).toBe('');
      host.close();
    },
    HANDSHAKE_TIMEOUT
  );

  it(
    'surfaces a failed render as a readable panel instead of a blank frame',
    async () => {
      const result = await callRender(endpoint, [
        { type: 'upsertDefinition', ref: 'bad', desktop: { 'not-a-real-css-prop': 'value' } }
      ]);
      const host = await startRenderingHost(page);

      await host.showResult(result);

      expect(host.text()).toContain('Render failed');
      expect(host.text()).toContain('not-a-real-css-prop');
      host.close();
    },
    HANDSHAKE_TIMEOUT
  );

  /** The patch flow, through the door a real host uses. The spec gives every tool call its OWN view
   *  (`ui/notifications/tool-input` is sent at most once), so the widget the model patches is never the instance
   *  that will show the result — these tests run the second view from scratch, as the host does. */
  it(
    'patches from a brand-new view, which is the only kind of view a host ever gives it',
    async () => {
      const storage = memoryStorage();
      const first = await callRender(endpoint, widget('Original title'));
      const shown = await startRenderingHost(page, { storage, client: endpoint.client });
      await shown.showResult(first);

      expect(shown.text()).toContain('Original title');
      // The host tears the view down when the turn ends; everything it held in memory goes with it.
      shown.close();

      const patch = await callPatch(endpoint, renderIdOf(first), 'Patched title');
      const next = await startRenderingHost(page, { storage, client: endpoint.client });
      await next.showResult(patch);
      await next.waitFor(() => next.text().includes('Patched title'));

      expect(next.text()).toContain('Patched title');
      expect(next.contextUpdates.join(' ')).toContain('Widget updated');
      next.close();
    },
    HANDSHAKE_TIMEOUT
  );

  it(
    'keeps two widgets patchable at once, each by its own renderId',
    async () => {
      const storage = memoryStorage();
      const alpha = await callRender(endpoint, widget('Alpha widget'));
      const beta = await callRender(endpoint, widget('Beta widget'));

      expect(renderIdOf(alpha)).not.toBe(renderIdOf(beta));

      for (const result of [alpha, beta]) {
        const view = await startRenderingHost(page, { storage, client: endpoint.client });
        await view.showResult(result);
        view.close();
      }

      // Patching the OLDER one must not pick up the newer widget's batch.
      const patch = await callPatch(endpoint, renderIdOf(alpha), 'Alpha patched');
      const view = await startRenderingHost(page, { storage, client: endpoint.client });
      await view.showResult(patch);
      await view.waitFor(() => view.text().includes('Alpha patched'));

      expect(view.text()).toContain('Alpha patched');
      expect(view.text()).not.toContain('Beta widget');
      view.close();
    },
    HANDSHAKE_TIMEOUT
  );

  it(
    'reports a patch it could not deliver instead of leaving the model waiting for a widget',
    async () => {
      const storage = memoryStorage();
      const first = await callRender(endpoint, widget('Interrupted widget'));
      // No client on this host: the re-call the patch needs cannot reach the server, exactly as it cannot when the
      // connection drops or the view is torn down mid-flight.
      const shown = await startRenderingHost(page, { storage });
      await shown.showResult(first);
      shown.close();

      const patch = await callPatch(endpoint, renderIdOf(first), 'Never arrives');
      const next = await startRenderingHost(page, { storage });
      await next.showResult(patch);
      await next.waitFor(() => next.contextUpdates.length > 0);

      expect(next.contextUpdates.join(' ')).toContain('could not be delivered');
      expect(next.text()).not.toContain('Never arrives');
      next.close();
    },
    HANDSHAKE_TIMEOUT
  );

  it(
    'never renders a widget belonging to another session: an unknown renderId reports back instead of guessing',
    async () => {
      const mine = memoryStorage();
      const theirs = memoryStorage();
      const first = await callRender(endpoint, widget('Their widget'));
      const theirView = await startRenderingHost(page, { storage: theirs, client: endpoint.client });
      await theirView.showResult(first);
      theirView.close();

      const patch = await callPatch(endpoint, renderIdOf(first), 'Stolen title');
      const myView = await startRenderingHost(page, { storage: mine, client: endpoint.client });
      await myView.showResult(patch);
      await myView.waitFor(() => myView.contextUpdates.length > 0);

      expect(myView.contextUpdates.join(' ')).toContain('could not be recovered');
      expect(myView.text()).not.toContain('Their widget');
      expect(myView.text()).not.toContain('Stolen title');
      myView.close();
    },
    HANDSHAKE_TIMEOUT
  );

  it(
    'honours the safe-area insets the host reports',
    async () => {
      const result = await callRender(endpoint, widget('Inset widget'));
      const host = await startRenderingHost(page, {
        hostContext: { safeAreaInsets: { top: 8, right: 9, bottom: 10, left: 11 } }
      });

      await host.showResult(result);

      const frame = host.window.document.getElementById('app')?.firstElementChild;
      expect(frame).toBeInstanceOf(host.window.HTMLElement);
      expect((frame as HTMLElement).style.padding).toBe('8px 9px 10px 11px');
      host.close();
    },
    HANDSHAKE_TIMEOUT
  );
});
