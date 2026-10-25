import http from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { acceptanceAccount, acceptancePages, acceptanceStatuses, examplePaths, pagesToLook } from './pagesOf';

import type { AddressInfo } from 'node:net';

const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

/** A site whose pages are these, each its links. */
const site = async (pages: Partial<Record<string, string[]>>): Promise<string> => {
  const server = http.createServer((request, response) => {
    const links = pages[request.url ?? '/'];
    response.writeHead(links ? 200 : 404, { 'content-type': 'text/html' });
    response.end(links ? links.map(href => `<a href="${href}">${href}</a>`).join('') : 'not found');
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  // Listening on a host and port, address() is an AddressInfo: its type is a union with the string a pipe answers.
  return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
};

// velada-now's fighter page — `/boxeadores/:slug` — had "no page" to look at: a page with a parameter was left out.
describe('examplePaths', () => {
  it('opens a page with a parameter where the site links to it — its list first, then the home page', async () => {
    // lx-fidelity: the first link that fits answers 404 — the nav's collection the catalog lacked — and is passed over.
    const origin = await site({
      '/': ['/', '/artistas/juanes', 'https://elsewhere.example/boxeadores/nope'],
      '/boxeadores': ['/boxeadores', '/boxeadores/alondrissa', '/boxeadores/lit-killah'],
      '/boxeadores/lit-killah': [],
      '/artistas/juanes': []
    });

    expect(await examplePaths(origin, ['/', '/boxeadores/:slug', '/artistas/:slug', '/combates/:id'])).toEqual({
      paths: ['/', '/boxeadores/lit-killah', '/artistas/juanes'],
      unreached: ['/combates/:id']
    });
  });

  // lx-copy: t-product's look never pictured its product page — no link reached it on a copy without the cards.
  it('opens a page with a parameter at an address the task names itself, before any link', async () => {
    const origin = await site({ '/': ['/'] });

    expect(await examplePaths(origin, ['/products/:slug'], ['/', '/products/acer-nitro'])).toEqual({
      paths: ['/products/acer-nitro'],
      unreached: []
    });
  });
});

// encore: the room's stats page — `/r/:slug/stats` — reached by no link, though the room's own address said its slug.
describe('examplePaths, a page no link reaches', () => {
  it('is filled with the parameters another page’s address gave, when that address answers', async () => {
    const origin = await site({
      '/': ['/', '/r/night-drive'],
      '/r/night-drive': [],
      '/r/night-drive/stats': []
    });

    expect(await examplePaths(origin, ['/r/:slug', '/r/:slug/stats', '/u/:handle'])).toEqual({
      paths: ['/r/night-drive', '/r/night-drive/stats'],
      unreached: ['/u/:handle']
    });
  });
});

// velada-shell's t-page-heading: a shared component's task, "no page of the space owns its files", its acceptance two.
describe('the pages an acceptance checks', () => {
  it('are read off its page commands, the options left out', () => {
    expect(
      acceptancePages([
        'In light, the links are the theme’s ink',
        { said: 'measured', check: 'plitzi page measure /combates "a => b" --url $PLITZI_URL --width 1440' },
        { said: 'whole', check: 'plitzi page check /combates /boxeadores --url $PLITZI_URL --width 1440,390' }
      ])
    ).toEqual(['/combates', '/boxeadores']);
  });
});

describe('the pages a look opens', () => {
  // encore-2: a look at the Reactions plugin's CSS, drawn at no page, pictured the home page.
  it('are those asked, else those its files draw, else those its acceptance checks — the home page last', () => {
    expect(pagesToLook(['/menu'], ['/home'], ['/r/:slug'])).toEqual(['/menu']);
    // Together: encore-4's look of t-retro-pass left out the page its acceptance checked, its files drawn elsewhere.
    expect(pagesToLook([], ['/home'], ['/r/night-drive'])).toEqual(['/home', '/r/night-drive']);
    expect(pagesToLook([], [], ['/r/night-drive'])).toEqual(['/r/night-drive']);
    expect(pagesToLook([], [], [])).toEqual(['/']);
  });
});

// encore-4: a look signed in as dax said "No link of the site reaches /u/:username" — the link is a signed-in visitor's.
describe('examplePaths, signed in', () => {
  it('follows the links a signed-in visitor has, with the session it is given', async () => {
    const server = http.createServer((request, response) => {
      const signedIn = request.headers.cookie === 'session=dax';
      const links =
        request.url === '/' ? (signedIn ? ['/u/dax'] : ['/sign-in']) : request.url === '/u/dax' ? [] : undefined;
      response.writeHead(links ? 200 : 404, { 'content-type': 'text/html' });
      response.end((links ?? []).map(href => `<a href="${href}">${href}</a>`).join(''));
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    // Listening on a host and port, address() is an AddressInfo: its type is a union with the string a pipe answers.
    const origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;

    expect(await examplePaths(origin, ['/u/:username'])).toEqual({ paths: [], unreached: ['/u/:username'] });
    expect(await examplePaths(origin, ['/u/:username'], [], 'session=dax')).toEqual({
      paths: ['/u/dax'],
      unreached: []
    });
  });
});

describe('the account a look reads as', () => {
  // encore-2: looks at /settings and /rooms/new pictured the sign-in panel; their acceptance checked them --as mika.
  it('is the one its acceptance checks the pages signed in as, else none', () => {
    expect(
      acceptanceAccount([
        { said: 'Settings', check: 'plitzi page check /settings --url $PLITZI_URL --width 1440,390 --as mika' },
        { said: 'Home', check: 'plitzi page check / --url $PLITZI_URL' }
      ])
    ).toBe('mika');
    expect(acceptanceAccount([{ said: 'Home', check: 'plitzi page check / --url $PLITZI_URL' }, 'Reads well'])).toBe(
      undefined
    );
  });

  it('says the pages its acceptance checks with a status of their own', () => {
    expect(
      acceptanceStatuses([
        {
          said: 'The 404 reads as Encore',
          check: 'npx plitzi page check /no-such-page --status 404 --expect not-found'
        },
        { said: 'Home', check: 'npx plitzi page check / --status 200' }
      ])
    ).toEqual([{ page: '/no-such-page', status: 404 }]);
  });
});
