import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RENDER_APP_URI } from '../apps';
import { readAppPage, startMcpEndpoint, startRenderingHost } from './index';

import type { McpEndpoint } from './index';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** The half a wire test cannot reach: the served ui:// page actually RUNNING, fetched from the live endpoint and
 *  driven through the official AppBridge. If these pass, only the host's own chrome stands between the widget
 *  and a user. */

const HANDSHAKE_TIMEOUT = 60_000;

const callRender = (endpoint: McpEndpoint, operations: unknown[]): Promise<CallToolResult> =>
  endpoint.client.callTool({ name: 'plitzi_render', arguments: { operations } }) as Promise<CallToolResult>;

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
        { type: 'upsertDefinition', ref: 'bad', desktop: { flex: '1 1 auto' } }
      ]);
      const host = await startRenderingHost(page);

      await host.showResult(result);

      expect(host.text()).toContain('Render failed');
      expect(host.text()).toContain('flex-grow');
      host.close();
    },
    HANDSHAKE_TIMEOUT
  );

  it(
    'honours the safe-area insets the host reports',
    async () => {
      const result = await callRender(endpoint, widget('Inset widget'));
      const host = await startRenderingHost(page, {
        safeAreaInsets: { top: 8, right: 9, bottom: 10, left: 11 }
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
