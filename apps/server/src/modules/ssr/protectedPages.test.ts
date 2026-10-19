import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { offlineDataOf, oneEmptyPage } from './tests/offlineData';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';
import { unusedPort } from '../../core/unusedPort';

import type { Schema, SSRRequest, SSRServer, SSRUser } from '@plitzi/sdk-shared';

/**
 * A page that says who may see it, over real HTTP: a visitor who may not is answered with its refusal and never its
 * content — not in the page, not in the space the browser fetches beside it, not by that space's name passed on.
 */

const PORT = await unusedPort();
const base = `http://127.0.0.1:${String(PORT)}`;
const SECRET = 'The release checklist, step by step';

const schema: Schema = {
  ...oneEmptyPage,
  pages: ['home', 'staff'],
  flat: {
    ...oneEmptyPage.flat,
    staff: {
      id: 'staff',
      attributes: { slug: 'staff', folder: '', default: false, access: { permissions: ['adminManage'] } },
      definition: { type: 'page', label: 'staff', rootId: 'staff', items: ['secret'], styleSelectors: { base: '' } }
    },
    secret: {
      id: 'secret',
      attributes: { content: SECRET },
      definition: {
        type: 'text',
        label: 'secret',
        rootId: 'staff',
        parentId: 'staff',
        items: [],
        styleSelectors: { base: '' }
      }
    }
  }
};

/** Who is asking, as the test says: a header naming their permissions, or nobody. */
const userOf = (req: SSRRequest): SSRUser | undefined => {
  const header = req.headers['x-test-permissions'];
  if (typeof header !== 'string') {
    return undefined;
  }

  return {
    token: `t-${header}`,
    id: 1,
    username: 'reader',
    email: 'reader@example.com',
    verified: true,
    roles: [],
    permissions: header.split(',').filter(Boolean)
  };
};

let server: SSRServer;

const documentPath = (html: string): string => /<link id="plitzi-space" href="([^"]+)"/.exec(html)?.[1] ?? '';

const as = (permissions?: string): RequestInit =>
  permissions === undefined ? {} : { headers: { 'x-test-permissions': permissions } };

beforeAll(async () => {
  server = createServer({
    port: PORT,
    devMode: true,
    adapters: {
      ...createJsonAdapters({ offlineData: offlineDataOf(schema) }),
      getUser: req => Promise.resolve(userOf(req))
    }
  });
  await server.listen(PORT, '127.0.0.1');

  await vi.waitFor(async () => {
    expect((await fetch(`${base}/`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('a page for some permissions', () => {
  it('is drawn whole, and sent in the space, for a visitor who holds them', async () => {
    const response = await fetch(`${base}/staff`, as('adminManage'));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(SECRET);
    expect(await (await fetch(`${base}${documentPath(html)}`, as('adminManage'))).text()).toContain(SECRET);
  });

  it('answers 403 to a visitor signed in without them, and sends its content nowhere', async () => {
    const response = await fetch(`${base}/staff`, as('spaceView'));
    const html = await response.text();

    expect(response.status).toBe(403);
    expect(html).not.toContain(SECRET);
    expect(html).toContain('data-withheld="forbidden"');
    expect(await (await fetch(`${base}${documentPath(html)}`, as('spaceView'))).text()).not.toContain(SECRET);
  });

  it('answers 401 to a visitor signed out', async () => {
    const response = await fetch(`${base}/staff`);

    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(SECRET);
  });

  it('withholds it from every page of the space, not only its own', async () => {
    const html = await (await fetch(`${base}/`)).text();

    expect(await (await fetch(`${base}${documentPath(html)}`)).text()).not.toContain(SECRET);
  });

  // A space is named by its content: the name of one built for somebody with access, passed on, is not a way in.
  it('does not hand the space built for somebody with access to somebody without it, by its name', async () => {
    const html = await (await fetch(`${base}/staff`, as('adminManage'))).text();
    const path = documentPath(html);

    expect(await (await fetch(`${base}${path}`)).text()).not.toContain(SECRET);
    expect(await (await fetch(`${base}${path}`, as('spaceView'))).text()).not.toContain(SECRET);
  });
});
