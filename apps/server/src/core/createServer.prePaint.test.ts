import { afterEach, describe, expect, it, vi } from 'vitest';

import { unusedPort } from '@plitzi/sdk-kernel/http';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style';

import { createServer } from './createServer';
import { createJsonAdapters } from '../adapters/jsonAdapters';

import type { SSRServer } from '../types';
import type { Element, Schema } from '@plitzi/sdk-shared';

/**
 * What a page's elements ask to run before it paints (`usePrePaint`) — a tab the address's hash names, which the server
 * never sees — is in the page the server sends, under its nonce, whether the page is sent whole or streamed.
 */

const node = (id: string, type: string, items: string[] = [], parentId?: string, attributes = {}): Element => ({
  id,
  attributes,
  definition: {
    type,
    label: id,
    rootId: 'home',
    items,
    styleSelectors: { base: '' },
    ...(parentId ? { parentId } : {})
  }
});

const schema = (hash: string): Schema => ({
  ...EMPTY_SCHEMA.schema,
  flat: {
    home: { ...node('home', 'page', ['tabs']), attributes: { name: 'Home', slug: '', folder: '', default: true } },
    tabs: node('tabs', 'tabContainer', ['head', 'body'], 'home'),
    head: node('head', 'tabContainerHeader', ['t1', 't2'], 'tabs'),
    t1: node('t1', 'tabContainerItem', [], 'head', hash ? { hash: 'overview' } : {}),
    t2: node('t2', 'tabContainerItem', [], 'head', hash ? { hash } : {}),
    body: node('body', 'tabContainerBody', ['p1', 'p2'], 'tabs'),
    p1: node('p1', 'tabContainerItem', [], 'body'),
    p2: node('p2', 'tabContainerItem', [], 'body')
  },
  pages: ['home']
});

let server: SSRServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

const page = async (streaming: boolean, hash: string): Promise<string> => {
  const port = await unusedPort();
  server = createServer({
    port,
    streaming,
    adapters: createJsonAdapters({ offlineData: { schema: schema(hash), style: EMPTY_STYLE_SCHEMA } })
  });
  await server.listen(port, '127.0.0.1');
  let html = '';
  await vi.waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${String(port)}/`);
    expect(response.status).toBe(200);
    html = await response.text();
  });

  return html;
};

describe('what a page runs before it paints', () => {
  it.each([false, true])('is sent with the page its tabs ask it of (streamed: %s), once', async streaming => {
    const html = await page(streaming, 'domains');

    expect(html).toContain('data-tab-hash="domains"');
    expect(html.match(/<script data-pre-paint="tab-hash"/g)).toHaveLength(1);
    // After the page it acts on, so the tabs are there when it runs.
    expect(html.indexOf('data-pre-paint="tab-hash"')).toBeGreaterThan(html.indexOf('data-tab-hash="domains"'));
  });

  it('is not sent when no element asks: tabs with no hash', async () => {
    const html = await page(false, '');

    expect(html).not.toContain('data-pre-paint');
  });
});
