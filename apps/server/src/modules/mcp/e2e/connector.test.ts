import { getToolUiResourceUri, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/app-bridge';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RENDER_APP_URI } from '../apps';
import { readAppPage, startMcpEndpoint } from './index';

import type { McpEndpoint } from './index';

/** Every step a remote connector (Claude Desktop, ChatGPT developer mode) takes before it can render anything,
 *  asserted through the OFFICIAL host helpers so a spec change fails here instead of killing the App silently. */

const widgetOperations = [
  { type: 'upsertDefinition', ref: 'headline', desktop: { 'font-size': '32px', color: '#3b82f6' } },
  {
    type: 'upsertElement',
    pageRef: 'render',
    element: {
      ref: 'greeting',
      type: 'heading',
      subType: 'h1',
      props: { content: 'Hello from plitzi_render' },
      style: { base: ['headline'] }
    }
  }
];

// Close to the real size (~1.67 MB) on purpose: the page travels inline on every read, so growth must be
// deliberate. What is left is mostly the SDK runtime and its stylesheet.
const PAGE_BUDGET_BYTES = 1_800_000;

describe('MCP connector (Streamable HTTP, no auth)', () => {
  let endpoint: McpEndpoint;

  beforeAll(async () => {
    endpoint = await startMcpEndpoint();
  }, 30_000);

  afterAll(async () => {
    await endpoint.close();
  });

  it('handshakes without credentials, so the public surface is reachable', () => {
    expect(endpoint.client.getServerVersion()?.name).toBe('plitzi-mcp');
    expect(endpoint.client.getInstructions()).toBeTruthy();
  });

  it('advertises plitzi_render with a ui:// resource a host can resolve', async () => {
    const { tools } = await endpoint.client.listTools();
    const render = tools.find(tool => tool.name === 'plitzi_render');

    expect(render).toBeDefined();
    expect(getToolUiResourceUri(render ?? {})).toBe(RENDER_APP_URI);
    // Both spellings ship, so a host that only knows the older flat key still finds the App.
    expect(render?._meta?.ui).toEqual({ resourceUri: RENDER_APP_URI });
    expect(render?._meta?.['ui/resourceUri']).toBe(RENDER_APP_URI);
  });

  it('lists the App under the MCP Apps mime type', async () => {
    const { resources } = await endpoint.client.listResources();
    const app = resources.find(resource => resource.uri === RENDER_APP_URI);

    expect(app?.mimeType).toBe(RESOURCE_MIME_TYPE);
  });

  it('serves a page the strictest sandbox can run, within its size budget', async () => {
    const { html, mimeType, meta } = await readAppPage(endpoint, RENDER_APP_URI);

    expect(mimeType).toBe(RESOURCE_MIME_TYPE);
    // Pinned as SERVED (apps.test.ts pins it as registered): tightening it must be a visible change.
    expect(meta?.ui).toEqual({ csp: { resourceDomains: ['*', 'data:', 'blob:'], connectDomains: ['*'] } });
    expect(html).not.toMatch(/<(?:script|link)[^>]+(?:src|href)=/u);
    expect(html).not.toContain('importmap');
    expect(Buffer.byteLength(html)).toBeLessThan(PAGE_BUDGET_BYTES);
  });

  it('returns a compact summary to the model and the widget payload to the App', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_render',
      arguments: { operations: widgetOperations }
    });

    const summary = JSON.stringify(result.content);
    expect(summary).toContain('"rendered\\":true');
    // The model must never pay for the payload: the widget rides out-of-band.
    expect(summary).not.toContain('offlineData');
    expect(result.structuredContent).toMatchObject({ rendered: true, rootRef: 'render', elementCount: 1 });
  });

  it('reports a failed render as teachable errors instead of an error response', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_render',
      arguments: { operations: [{ type: 'upsertDefinition', ref: 'bad', desktop: { flex: '1 1 auto' } }] }
    });

    expect(result.isError).toBeFalsy();
    expect(JSON.stringify(result.content)).toContain('flex-grow');
  });
});

/** Requests fired outside the JSON-RPC session. Each one is a real hang or failed connection seen against a
 *  desktop host. */
describe('connector probes (what a desktop host sends before/around the session)', () => {
  let endpoint: McpEndpoint;

  beforeAll(async () => {
    endpoint = await startMcpEndpoint();
  }, 30_000);

  afterAll(async () => {
    await endpoint.close();
  });

  it('answers the CORS preflight, so a browser-based host may connect', async () => {
    const response = await endpoint.request({ method: 'OPTIONS' });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('refuses the GET event stream instead of leaving the host hanging on it', async () => {
    const response = await endpoint.request({ method: 'GET' });

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toContain('POST');
  });

  it('answers OAuth discovery with a clean 404, so auth negotiation does not stall', async () => {
    const response = await endpoint.request({ path: '/.well-known/oauth-protected-resource' });

    expect(response.status).toBe(404);
  });
});
