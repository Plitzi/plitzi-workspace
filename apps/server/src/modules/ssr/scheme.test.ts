import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style';

import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';
import { unusedPort } from '../../core/unusedPort';

import type { Element, Schema, SSRServer } from '@plitzi/sdk-shared';

/**
 * A `system` theme drawn on the server as the visitor's machine asks: the scheme the browser kept, or the one Chromium
 * says in its client hint — so `{{ theme.resolved }}` (a picture's address, a label) is the same before and after the
 * page hydrates.
 */

const PORT = await unusedPort();
const BASE = `http://127.0.0.1:${String(PORT)}`;

const element = (id: string, type: string, items: string[] = [], parentId?: string): Element => ({
  id,
  attributes: {},
  definition: {
    type,
    label: id,
    rootId: 'home',
    items,
    styleSelectors: { base: '' },
    ...(parentId ? { parentId } : {})
  }
});

const schema: Schema = {
  ...EMPTY_SCHEMA.schema,
  flat: {
    home: { ...element('home', 'page', ['scheme']), attributes: { name: 'Home', slug: '', folder: '', default: true } },
    scheme: {
      ...element('scheme', 'text', [], 'home'),
      attributes: { content: '' },
      definition: {
        ...element('scheme', 'text', [], 'home').definition,
        bindings: { attributes: [{ id: 'b0', to: 'content', source: 'theme.resolved' }] }
      }
    }
  },
  pages: ['home']
};

let server: SSRServer;

/** The text the server drew from `theme.resolved`. */
const drawn = async (headers: Record<string, string>): Promise<string | undefined> => {
  const html = await (await fetch(`${BASE}/`, { headers })).text();

  return /data-plitzi-el="scheme"[^>]*>([^<]*)</.exec(html)?.[1];
};

beforeAll(async () => {
  server = createServer({
    port: PORT,
    adapters: createJsonAdapters({ offlineData: { schema, style: EMPTY_STYLE_SCHEMA } })
  });
  await server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await fetch(`${BASE}/`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('a system theme, drawn on the server', () => {
  it('in the scheme the browser kept, or the one its client hint says, else light', async () => {
    expect(await drawn({ cookie: 'theme=system; theme-scheme=dark' })).toBe('dark');
    expect(await drawn({ 'sec-ch-prefers-color-scheme': '"dark"' })).toBe('dark');
    expect(await drawn({})).toBe('light');
  });

  // A choice is a choice: the machine's scheme says nothing about a visitor who picked light.
  it('as the visitor chose it, whatever the machine says', async () => {
    expect(await drawn({ cookie: 'theme=light; theme-scheme=dark' })).toBe('light');
  });
});
