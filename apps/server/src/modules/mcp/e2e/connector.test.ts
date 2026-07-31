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

// The advertised tool schemas sit in the model's context on EVERY request of every conversation this server is
// connected to, so they are the most expensive thing the MCP owns — far more than any payload a tool ever carries.
// Four tools take the op union; inlining it in each measured ~102k tokens until the shared subschemas were given
// registry ids (see operations/schemaIds.ts). This budget is what stops that from creeping back silently.
const TOOLS_BUDGET_BYTES = 170_000;

// Close to the real size (~1.67 MB) on purpose: the page travels inline on every read, so growth must be
// deliberate. What is left is mostly the SDK runtime and its stylesheet.
const PAGE_BUDGET_BYTES = 2_000_000;

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

  // The op union travels to the host as JSON Schema, and a recursive op can make that conversion blow the stack —
  // the server then answers tools/list with an internal error and the connector is dead. Only a real listing over
  // the wire catches it: the unit tests never serialise the schema.
  it('serialises every tool schema, including the recursive template ops', async () => {
    const { tools } = await endpoint.client.listTools();

    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.inputSchema, `${tool.name} has no input schema`).toBeTruthy();
      expect(() => JSON.stringify(tool.inputSchema)).not.toThrow();
    }

    const schema = JSON.stringify(tools.find(tool => tool.name === 'plitzi_render')?.inputSchema);
    expect(schema).toContain('repeatElement');
    expect(schema).toContain('upsertDefinitions');
  });

  // Measured on a connection WITH a space: that is the full listing, and the one the budget is about — the guest
  // surface advertises a fraction of it.
  it('keeps the whole tool listing inside its token budget, with the shared schemas factored out', async () => {
    const attached = await startMcpEndpoint({ spaceId: 1 });
    try {
      const { tools } = await attached.client.listTools();
      const listing = tools.reduce(
        (total, tool) => total + JSON.stringify(tool.inputSchema).length + (tool.description?.length ?? 0),
        0
      );

      expect(listing).toBeLessThan(TOOLS_BUDGET_BYTES);
      // The op union must arrive as refs into `definitions`, not as N inlined copies of the same element/CSS shapes.
      const apply = tools.find(tool => tool.name === 'plitzi_apply')?.inputSchema as {
        definitions?: Record<string, unknown>;
      };
      expect(Object.keys(apply.definitions ?? {})).toEqual(expect.arrayContaining(['Element', 'Css', 'RuleGroup']));
    } finally {
      await attached.close();
    }
  });

  it('renders a nested repeat over the wire — the shape a real list widget uses', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_render',
      arguments: {
        operations: [
          { type: 'upsertDefinitions', definitions: { list: { desktop: { display: 'flex' } } } },
          {
            type: 'repeatElement',
            pageRef: 'render',
            ref: 'timeline',
            style: { base: ['list'] },
            template: {
              ref: 'day',
              type: 'container',
              children: [
                { ref: 'title', type: 'heading', subType: 'h3', props: { content: '{{item.park}}' } },
                {
                  ref: 'body',
                  type: 'container',
                  repeat: {
                    items: '{{item.blocks}}',
                    template: { ref: 'blk', type: 'text', props: { content: '{{item.text}}' } }
                  }
                }
              ]
            },
            items: [
              { park: 'Magic Kingdom', blocks: [{ text: 'Rope drop' }, { text: 'Space Mountain' }] },
              { park: 'EPCOT', blocks: [{ text: 'Cosmic Rewind' }] }
            ]
          }
        ]
      }
    });

    // 1 wrapper + 2 days × (title + body) + 3 blocks.
    expect(result.structuredContent).toMatchObject({ rendered: true, elementCount: 10 });
  });

  // Iterating on a widget must not cost the whole widget again. The server cannot merge the delta itself (it keeps
  // nothing between calls), so it answers with a courier result the open view merges and re-sends — these two tests
  // pin the halves of that contract the model and the view depend on.
  it('hands a patch back as a courier result instead of trying to render it', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_render',
      arguments: {
        patch: true,
        renderId: 'r7f3a2c',
        operations: [{ type: 'patchDefinition', ref: 'headline', desktop: { color: 'red' } }]
      }
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ patch: true, renderId: 'r7f3a2c' });
    // The delta rides out-of-band for the view; the model only gets told what happened.
    expect((result.structuredContent as { operations: unknown[] }).operations).toHaveLength(1);
    expect(JSON.stringify(result.content)).not.toContain('offlineData');
    expect(JSON.stringify(result.content)).toContain('patch');
  });

  it('defers validation on a patch instead of judging the delta against an empty widget', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_render',
      arguments: {
        patch: true,
        renderId: 'r7f3a2c',
        // `card-3` exists only in the widget the view is holding; validating here would reject a valid patch.
        operations: [{ type: 'patchElement', pageRef: 'render', ref: 'card-3', props: { content: 'x' } }]
      }
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ patch: true });
    expect(JSON.stringify(result.content)).not.toContain('not found');
  });

  it('refuses a patch with no renderId: nothing names the widget it would be merged into', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_render',
      arguments: {
        patch: true,
        operations: [{ type: 'patchDefinition', ref: 'headline', desktop: { color: 'red' } }]
      }
    });

    expect(JSON.stringify(result.content)).toContain('renderId');
    expect(result.structuredContent).toBeUndefined();
  });

  it('refuses an empty patch, which would merge nothing and re-render the same widget', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_render',
      arguments: { patch: true, operations: [] }
    });

    const text = JSON.stringify(result.content);
    expect(text).toContain('no operations');
    // Nothing to hand the view: no courier payload, so it never re-renders.
    expect(result.structuredContent).toBeUndefined();
  });

  it('returns the batch it rendered so the view can merge a later patch into it', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_render',
      arguments: { operations: widgetOperations }
    });

    // Out-of-band only: the view needs it, the model must never pay for it.
    expect((result.structuredContent as { operations: unknown[] }).operations).toHaveLength(widgetOperations.length);
    expect(JSON.stringify(result.content)).not.toContain('upsertDefinition');
  });

  it('reports a row missing a template field as a teachable error, naming the row', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_render',
      arguments: {
        operations: [
          {
            type: 'repeatElement',
            pageRef: 'render',
            ref: 'list',
            template: { ref: 'row', type: 'text', props: { content: '{{item.text}}' } },
            items: [{ text: 'ok' }, { nope: 'x' }]
          }
        ]
      }
    });

    expect(result.isError).toBeFalsy();
    const text = JSON.stringify(result.content);
    expect(text).toContain('items[1]');
    expect(text).toContain('Row 2');
  });

  it('reports a failed render as teachable errors instead of an error response', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_render',
      arguments: {
        operations: [{ type: 'upsertDefinition', ref: 'bad', desktop: { 'not-a-real-css-prop': 'value' } }]
      }
    });

    expect(result.isError).toBeFalsy();
    expect(JSON.stringify(result.content)).toContain('Unknown CSS property');
  });
});

/** A connection carrying no space — a guest connection or a widgets-only grant. What it must never do is let the
 *  agent spend its turn discovering that: an editing tool it can call but that always refuses reads to the host
 *  (and its user) as a broken server, which is how "cannot connect to Plitzi MCP" ends up on screen. */
describe('guest connection (a grant that carries no space)', () => {
  let endpoint: McpEndpoint;

  beforeAll(async () => {
    endpoint = await startMcpEndpoint();
  }, 30_000);

  afterAll(async () => {
    await endpoint.close();
  });

  it('says what this connection is in the handshake, before anything is called', () => {
    const instructions = endpoint.client.getInstructions() ?? '';

    expect(instructions).toContain('NO Plitzi space');
    expect(instructions).toContain('plitzi_render');
  });

  it('offers only the tools that work without a space, so none of them is a dead end', async () => {
    const { tools } = await endpoint.client.listTools();

    expect(tools.map(tool => tool.name).sort()).toEqual(['plitzi_read', 'plitzi_render']);
  });

  it('lists only the resources it can actually open', async () => {
    const { resources } = await endpoint.client.listResources();
    const uris = resources.map(resource => resource.uri);

    expect(uris).toContain('plitzi://render/guide');
    expect(uris).not.toContain('plitzi://schema/main/pages');
  });

  it('reads the render docs through plitzi_read, the tool an agent reaches for', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_read',
      arguments: { uris: ['plitzi://render/guide', 'plitzi://render/types'] }
    });

    expect(result.isError).toBeFalsy();
    const [guide, types] = (JSON.parse((result.content as { text: string }[])[0].text) as { results: unknown[] })
      .results as { data?: unknown; error?: string }[];
    expect(typeof guide.data).toBe('string');
    expect(types.error).toBeUndefined();
  });

  it('answers a space URI as a state of the connection, not as a failed call', async () => {
    const result = await endpoint.client.callTool({
      name: 'plitzi_read',
      arguments: { uris: ['plitzi://schema/main/pages'] }
    });

    // isError is what a host renders as "cannot connect to this server", so the distinction is the whole point.
    expect(result.isError).toBeFalsy();
    const text = JSON.stringify(result.content);
    expect(text).toContain('NO_SPACE_ATTACHED');
    expect(text).toContain('plitzi_render');
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
