import http from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import {
  acceptanceAccount,
  acceptanceAddresses,
  acceptancePages,
  acceptanceStatuses,
  examplePaths,
  filledPattern,
  pagesToLook
} from './pagesOf';

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

// A run's fighter page — `/boxeadores/:slug` — had "no page" to look at: a page with a parameter was left out.
describe('examplePaths', () => {
  it('opens a page with a parameter where the site links to it — its list first, then the home page', async () => {
    // The first link that fits answers 404 — the nav's collection the catalog lacked — and is passed over.
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

  // T-product's look never pictured its product page — no link reached it on a copy without the cards.
  it('opens a page with a parameter at an address the task names itself, before any link', async () => {
    const origin = await site({ '/': ['/'] });

    expect(await examplePaths(origin, ['/products/:slug'], ['/', '/products/acer-nitro'])).toEqual({
      paths: ['/products/acer-nitro'],
      unreached: []
    });
  });

  // A run's look pictured /r/:slug as the first room its tasks named, never the other one whose change it showed.
  it('opens every address the tasks name for one route', async () => {
    const origin = await site({ '/': ['/'] });

    expect(await examplePaths(origin, ['/r/:slug'], ['/r/night-drive', '/r/sunday-lofi', '/rooms'])).toEqual({
      paths: ['/r/night-drive', '/r/sunday-lofi'],
      unreached: []
    });
  });
});

// The room's stats page — `/r/:slug/stats` — reached by no link, though the room's own address said its slug.
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

// A shared component's task, "no page of the space owns its files", its acceptance two.
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
  // A look at the Reactions plugin's CSS, drawn at no page, pictured the home page.
  it('are those asked, else those its files draw, else those its acceptance checks — the home page last', () => {
    expect(pagesToLook(['/menu'], ['/home'], ['/r/:slug'])).toEqual(['/menu']);
    // Together: a run's look of t-retro-pass left out the page its acceptance checked, its files drawn elsewhere.
    expect(pagesToLook([], ['/home'], ['/r/night-drive'])).toEqual(['/home', '/r/night-drive']);
    expect(pagesToLook([], [], ['/r/night-drive'])).toEqual(['/r/night-drive']);
    expect(pagesToLook([], [], [])).toEqual(['/']);
  });
});

// A look signed in as dax said "No link of the site reaches /u/:username" — the link is a signed-in visitor's.
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
  // Looks at /settings and /rooms/new pictured the sign-in panel; their acceptance checked them --as mika.
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
          said: 'The 404 reads as Acme',
          check: 'npx plitzi page check /no-such-page --status 404 --expect not-found'
        },
        { said: 'Home', check: 'npx plitzi page check / --status 200' }
      ])
    ).toEqual([{ page: '/no-such-page', status: 404 }]);
  });
});

// A run's designer was handed `task look t-dm-words /messages/:username`: no link reached the pattern, and the look
// checked the home page instead — the address was in the acceptance, said in words.
describe('the addresses an acceptance names', () => {
  it('reads them from what is said as from what is checked, and fills a route’s pattern with one that fits', () => {
    const named = acceptanceAddresses([
      '/messages/nobodyhere as dax shows "Nobody here goes by that name." at 1440 and 390',
      "A legend on /design's panels keeps its gap",
      { said: 'The room', check: 'npx plitzi page check /r/night-drive --as dax' },
      'src/space/pages/messages-thread.ts changes'
    ]);

    expect(named).toEqual(['/r/night-drive', '/messages/nobodyhere', '/design']);
    expect(filledPattern('/messages/:username', named)).toBe('/messages/nobodyhere');
    expect(filledPattern('/u/:username', named)).toBe('/u/:username');
    expect(filledPattern('/design', named)).toBe('/design');
    // A route deeper than any address named, filled from the one that names its first parts — never offered as the
    // pattern itself, which a run's look could not reach.
    expect(filledPattern('/r/:slug/stats', named)).toBe('/r/night-drive/stats');
    expect(filledPattern('/rooms/:id/edit', named)).toBe('/rooms/:id/edit');
  });
});
