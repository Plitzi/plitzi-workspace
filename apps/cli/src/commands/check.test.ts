// @vitest-environment jsdom
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkAccount,
  clickedText,
  contestedText,
  inertText,
  listText,
  LOOK_PROPERTIES,
  lookChanges,
  looksInPage,
  momentChanges,
  notShownInPage,
  pageFor,
  renderedRowsInPage,
  serverErrors,
  meantOnPage,
  wrappedLabelsInPage
} from './check';

const marked = (id: string): string => `[data-plitzi-el="${id}"]`;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('plitzi page check / a list’s rows', () => {
  it('counts the rows the page draws, one per copy of the row inside the list, and none for a list not on it', () => {
    document.body.innerHTML = `
      <ul data-plitzi-el="feed">
        <li data-plitzi-el="feed-row"><span data-plitzi-el="feed-badge"></span></li>
        <li data-plitzi-el="feed-row"></li>
        <li data-plitzi-el="feed-row"><span data-plitzi-el="feed-badge"></span></li>
      </ul>
      <ul data-plitzi-el="empty"></ul>
      <ol data-plitzi-el="dog-vaccines"><li data-plitzi-el="vaccine-row"></li><li data-plitzi-el="vaccine-row"></li></ol>
      <ol data-plitzi-el="dog-vaccines"><li data-plitzi-el="vaccine-row"></li></ol>`;

    expect(
      renderedRowsInPage([
        { id: 'feed', selector: marked('feed'), row: [marked('feed-badge'), marked('feed-row')] },
        { id: 'empty', selector: marked('empty'), row: [marked('empty-row')] },
        { id: 'hits', selector: marked('hits'), row: [marked('hits-row')] },
        { id: 'dog-vaccines', selector: marked('dog-vaccines'), row: [marked('vaccine-row')] }
      ])
    ).toEqual([
      ['feed', [3]],
      ['empty', [0]],
      ['hits', null],
      // A list inside another's row: its rows in each copy, not only the first's.
      ['dog-vaccines', [2, 1]]
    ]);
  });

  it('says what is drawn beside what the source holds', () => {
    expect(listText('plan-list', { rendered: 3, source: 3 })).toBe('plan-list 3 rows');
    expect(listText('home-writer-list', { rendered: 4, source: 8 })).toBe('home-writer-list 4 of 8 rows');
    expect(listText('search-hits', { rendered: null, source: 16 })).toBe('search-hits not rendered (16 in its source)');
    expect(listText('feed', { rendered: 0, source: null })).toBe('feed reads nothing');
    // A source the address names is read by the page, not the check: what it draws is said, never "reads nothing".
    expect(listText('policy-sections', { rendered: 13, source: null })).toBe(
      'policy-sections 13 rows drawn — its source not read here (one the address names)'
    );
    // A list inside another's row, one copy left after a search: fed by its row, with no whole to count.
    expect(listText('faq-questions', { rendered: 1, source: 0 })).toBe('faq-questions 1 row, fed by the row it is in');
    expect(listText('vaccineRows', { rendered: 9, source: 9, copies: [2, 3, 4] })).toBe(
      'vaccineRows 9 rows in 3 copies (2, 3, 4) of 9 in its source'
    );
  });
});

describe('plitzi page check / what the page is not showing', () => {
  it('names an element with a condition of its own that has no node, or none the browser draws', () => {
    // jsdom lays nothing out: what the browser draws is said here, by a mark on the node.
    Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
      configurable: true,
      value(this: HTMLElement) {
        return this.dataset.drawn === 'yes';
      }
    });
    document.body.innerHTML = `
      <div data-plitzi-el="shown" data-drawn="yes"></div>
      <div data-plitzi-el="folded"></div>
      <div data-plitzi-el="slot" style="display: contents"><p data-drawn="yes"></p></div>`;

    expect(notShownInPage(['shown', 'folded', 'slot', 'unmounted'].map(id => ({ id, selector: marked(id) })))).toEqual([
      'folded',
      'unmounted'
    ]);

    Reflect.deleteProperty(HTMLElement.prototype, 'checkVisibility');
  });
});

// Two classes set the same property: which one the page shows is the question an agent cannot answer from the code.
describe('the styles an element’s classes contest', () => {
  it('says the value shown, the class it comes from and what the others say — a shorthand’s longhands once', () => {
    const corner = (property: string) => ({
      property,
      declared: [
        { className: 'button-primary', value: '12px' },
        { className: 'ent-cta-pill', value: '999px' }
      ],
      shown: '999px',
      winner: 'ent-cta-pill'
    });

    expect(
      contestedText(
        [
          ...['top-left', 'top-right', 'bottom-right', 'bottom-left'].map(at => corner(`border-${at}-radius`)),
          {
            property: 'color',
            declared: [
              { className: 'a', value: 'red' },
              { className: 'b', value: 'red' }
            ],
            shown: 'rgb(255, 0, 0)'
          }
        ],
        { 'button-primary': ['site-cta', 'write-cta'], 'ent-cta-pill': [], a: [], b: [] }
      )
    ).toEqual([
      'border-top-left-radius and 3 more like it: 999px, from ent-cta-pill (button-primary says 12px) — button-primary is also on site-cta, write-cta: changing the class itself changes them too',
      'color: rgb(255, 0, 0) — a and b all set it so; it stays rgb(255, 0, 0) without any one of them'
    ]);
  });

  // A class that shares one property may set others: only one whose every property stays is said to change nothing.
  it('says a class changes nothing only when every property it sets stays without it, and how far that was measured', () => {
    expect(inertText([{ className: 'ent-cta-pill', properties: 1 }], 1440, { 'ent-cta-pill': ['site-cta'] })).toEqual([
      'ent-cta-pill changes nothing on it at rest at 1440 px: each of the 1 property it sets stays as it is without it (a hover or another width may still need it). To drop it here, take it off this element’s `class`; ent-cta-pill is also on site-cta: changing the class itself changes it too.'
    ]);
  });
});

// A button whose flow does nothing looks like one that works, until it is clicked and every change is read off.
describe('what a click changed', () => {
  const moment = { url: '/enterprise', scrolls: { page: 3309 }, shown: ['footer', 'top'], said: [] };

  it('says where the page went, what scrolled, came and went, and the state', () => {
    expect(
      momentChanges(
        moment,
        { url: '/enterprise#plans', scrolls: { page: 0, faq: 120 }, shown: ['top', 'hero'], said: ['Link copied'] },
        { before: { menuOpen: false }, after: { menuOpen: true, faq: 'a' } }
      )
    ).toEqual([
      'went to /enterprise#plans (from /enterprise)',
      'the page scrolled 3309 → 0 px',
      'faq scrolled 0 → 120 px',
      'now shown: hero',
      'no longer shown: footer',
      'said: "Link copied"',
      'state.menuOpen: false → true',
      'state.faq: unset → "a"'
    ]);
  });

  it('says a click that changed nothing, in so many words', () => {
    expect(
      clickedText({ element: 'top', changes: momentChanges(moment, moment, { before: {}, after: {} }), failed: [] })
    ).toEqual([
      '  · clicking top changed nothing: no flow ran, the page went nowhere, nothing scrolled, appeared or went, nothing was said, and the state is as it was'
    ]);
  });

  it('says the fields it filled before the click', () => {
    expect(
      clickedText({
        element: 'send',
        filled: ['news-email = "ana@example.com"'],
        changes: ['state.newsSubscribed: unset → true'],
        failed: []
      })
    ).toEqual([
      '  · filled news-email = "ana@example.com"',
      '  · clicking send:',
      '      state.newsSubscribed: unset → true'
    ]);
  });
});

// A hover changes how things look far more often than what is on the page: its colours, its lift, its shadow.
describe('what a hover changed', () => {
  it('reads how an element and the elements inside it look, and says each property that changed', () => {
    document.body.innerHTML =
      '<a data-plitzi-el="cta" style="color: rgb(0, 0, 0)"><span data-plitzi-el="cta-arrow" style="opacity: 0.5">→</span></a>';
    const before = looksInPage({ selector: marked('cta'), properties: LOOK_PROPERTIES });
    document.querySelector<HTMLElement>(marked('cta'))?.style.setProperty('color', 'rgb(255, 0, 0)');
    document.querySelector<HTMLElement>(marked('cta-arrow'))?.style.setProperty('opacity', '1');

    expect(Object.keys(before)).toEqual(['cta', 'cta-arrow']);
    expect(lookChanges(before, looksInPage({ selector: marked('cta'), properties: LOOK_PROPERTIES }))).toEqual([
      'cta color: rgb(0, 0, 0) → rgb(255, 0, 0)',
      'cta-arrow opacity: 0.5 → 1'
    ]);
    expect(looksInPage({ selector: marked('gone'), properties: LOOK_PROPERTIES })).toEqual({});
  });

  it('says a hover it did not do at a phone’s width, and why', () => {
    expect(
      clickedText({ element: 'cta', hovered: true, skipped: 'not at 390 px — no pointer', changes: [], failed: [] })
    ).toEqual(['  · hovering cta: not at 390 px — no pointer']);
  });

  // The pointer over a button is over its row too: a hover the row carries (li:hover) is the row's, said as such.
  it('reads the elements around the one hovered, and what a hover widens', () => {
    document.body.innerHTML =
      '<li data-plitzi-el="faq-row" style="background-color: rgb(0, 0, 0)"><button data-plitzi-el="faq-question"><span data-plitzi-el="faq-rule" style="width: 32px">—</span></button></li>';
    const read = () => looksInPage({ selector: marked('faq-question'), properties: LOOK_PROPERTIES, ancestors: 3 });
    const before = read();
    document.querySelector<HTMLElement>(marked('faq-row'))?.style.setProperty('background-color', 'rgb(10, 10, 10)');
    document.querySelector<HTMLElement>(marked('faq-rule'))?.style.setProperty('width', '48px');

    expect(Object.keys(before)).toEqual(['faq-row', 'faq-question', 'faq-rule']);
    expect(lookChanges(before, read())).toEqual([
      'faq-row background-color: rgb(0, 0, 0) → rgb(10, 10, 10)',
      'faq-rule width: 32px → 48px'
    ]);
  });

  it('says a hover that changed nothing, its look included', () => {
    expect(clickedText({ element: 'cta', hovered: true, changes: [], failed: [] })).toEqual([
      '  · hovering cta changed nothing: no flow ran, the page went nowhere, nothing scrolled, appeared or went, nothing was said, the state is as it was, and it and its elements look as they did'
    ]);
    expect(
      clickedText({ element: 'cta', hovered: true, problem: 'no element cta is on this page', changes: [], failed: [] })
    ).toEqual(['  - hover: no element cta is on this page']);
  });
});

describe('the account a check signs in as', () => {
  const projectWith = async (env: string): Promise<string> => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-check-account-'));
    await fs.writeFile(path.join(root, '.env'), env);

    return root;
  };

  it('is the project’s own, from .env, and the one named over it', async () => {
    const root = await projectWith('PLITZI_CHECK_USER=carla\nPLITZI_CHECK_PASSWORD=inkwell\n');

    expect(await checkAccount(root)).toEqual({ username: 'carla', password: 'inkwell' });
    expect(await checkAccount(root, 'maya')).toEqual({ username: 'maya', password: 'inkwell' });
    await fs.rm(root, { recursive: true });
  });

  it('reads the environment over .env, as the project’s scripts do', async () => {
    const root = await projectWith('PLITZI_CHECK_USER=carla\nPLITZI_CHECK_PASSWORD=inkwell\n');
    vi.stubEnv('PLITZI_CHECK_PASSWORD', 'from-the-shell');

    expect(await checkAccount(root)).toEqual({ username: 'carla', password: 'from-the-shell' });
    vi.unstubAllEnvs();
    await fs.rm(root, { recursive: true });
  });

  it('is none when nothing names one, and says the password it lacks', async () => {
    const root = await projectWith('PLITZI_CHECK_USER=carla\n');

    const lacking = await checkAccount(root);

    expect(lacking && 'problem' in lacking ? lacking.problem : lacking).toContain(
      'carla signs in with the password in PLITZI_CHECK_PASSWORD: set it in .env'
    );
    await fs.writeFile(path.join(root, '.env'), '');
    expect(await checkAccount(root)).toBeUndefined();
    await fs.rm(root, { recursive: true });
  });
});

describe('the page an address is answered by', () => {
  const page = (id: string, path: string, slug = path.slice(1)) => ({ id, path, slug, elements: {} });
  const handles = {
    pages: {
      home: page('home', '/'),
      post: page('post', '/p/:slug'),
      lost: page('lost', '/*', '*'),
      docsLost: page('docsLost', '/docs/*', '*'),
      docs: page('docs', '/docs/intro', 'intro'),
      // A page of its own that answers a whole subtree: not a "not found" page.
      editor: page('editor', '/spaces/:spaceId/update/*')
    }
  } as unknown as Parameters<typeof pageFor>[0];

  it('is a page with a path of its own before any "not found" page — `/*` would answer `/` too', () => {
    expect(pageFor(handles, '/')).toBe('home');
    expect(pageFor(handles, '/p/hello')).toBe('post');
    expect(pageFor(handles, '/docs/intro')).toBe('docs');
  });

  it('is the page of the path alone: a query or a hash names none', () => {
    expect(pageFor(handles, '/?__pt=weather')).toBe('home');
    expect(pageFor(handles, '/p/hello?ref=mail#comments')).toBe('post');
  });

  it('is a page answering a subtree by its own `*`, never the "not found" page', () => {
    expect(pageFor(handles, '/spaces/7/update/pages/home')).toBe('editor');
  });

  /** The router answers every page at its own id too: `/post` is the post page, whatever its route says. */
  it('is a page by its own id before a "not found" page, after every route', () => {
    expect(pageFor(handles, '/post')).toBe('post');
    expect(pageFor(handles, '/home')).toBe('home');
    expect(pageFor(handles, '/nope')).toBe('lost');
  });

  it('is the deepest folder’s "not found" page, then the space’s', () => {
    expect(pageFor(handles, '/docs/nope')).toBe('docsLost');
    expect(pageFor(handles, '/nope/at/all')).toBe('lost');
  });
});

/** A service of somebody else's failing for a second is looked at again; a request that is wrong fails the same way. */
describe('what a page check looks at again', () => {
  it('is what the server failed, never what it refused', () => {
    expect(
      serverErrors({
        path: '/',
        width: 1440,
        ok: false,
        checked: 1,
        problems: [],
        issues: [],
        hiddenAtWidth: [],
        empty: [],
        consoleErrors: [],
        failedRequests: ['500 /fn/aiko/weather', '404 /missing.png', '503 /fn/aiko/news'],
        devTools: false,
        lists: {}
      })
    ).toEqual(['500 /fn/aiko/weather', '503 /fn/aiko/news']);
  });
});

describe('a short label the page breaks onto two lines', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('is said with its lines — a long one, one on one line, or blocks stacked on purpose, is not', () => {
    document.body.innerHTML = [
      '<a data-plitzi-el="site-nav-digest" href="/digest">This week</a>',
      '<a data-plitzi-el="site-nav-home" href="/">Home</a>',
      '<a data-plitzi-el="site-brand" href="/"><i class="fa-paw"></i>Pet Friends</a>',
      '<a data-plitzi-el="home-lede" href="/about">A whole sentence that wraps as text does</a>',
      // An eyebrow over a name, two blocks stacked on purpose: two lines of one each, no label broken.
      '<a data-plitzi-el="artist-prev-card" href="/artistas/juanes"><div>Artista anterior</div><div>Juanes</div></a>',
      // lx-copy: a tile's title over its call — four words read apart, never "GRÁFICASCompra": no label.
      '<a data-plitzi-el="tile-gpu" href="/c/gpu"><div>TARJETAS GRÁFICAS</div><div>Compra ahora</div></a>',
      // Three words in two blocks, the title wrapping: the label said is the block that wraps.
      '<a data-plitzi-el="tile-pc" href="/c/pc"><div>PC GAMER</div><div>Ver</div></a>'
    ].join('');
    // jsdom lays nothing out: what the browser draws is said here — two lines for the menu's squeezed label.
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value(this: Range) {
        const text = this.startContainer.textContent;

        const wraps = text === 'This week' || text === 'TARJETAS GRÁFICAS' || text === 'PC GAMER';

        return (wraps ? [0, 20] : text === 'Juanes' ? [20] : [0]).map(top => ({ top, height: 18 }));
      }
    });

    try {
      expect(wrappedLabelsInPage('a[data-plitzi-el]')).toEqual([
        { id: 'site-nav-digest', label: 'This week', lines: 2 },
        { id: 'tile-pc', label: 'PC GAMER', lines: 2 }
      ]);
    } finally {
      Reflect.deleteProperty(Range.prototype, 'getClientRects');
    }
  });
});

describe('an expected element that is not on the page', () => {
  it('says the row id a per-row name meant, or the nearest id, or nothing', () => {
    const onPage = ['summary-title', 'summary-trend', 'summary-trend', 'summary-trend', 'summary-lede'];

    expect(meantOnPage('summary-trend-luna', onPage)).toBe(
      ' — summary-trend is, 3 times: a list’s row has the same ids in every row, so none is named per row; --expect reads the first'
    );
    expect(meantOnPage('summary-titel', onPage)).toBe(' — did you mean summary-title?');
    expect(meantOnPage('walks-filter', onPage)).toBe('');
  });
});

describe('a list drawn in every row of another', () => {
  it('says each copy is fed by its row when its source is the row’s', () => {
    expect(listText('faq-questions', { rendered: 16, source: 0, copies: [4, 4, 4, 4] })).toBe(
      'faq-questions 16 rows in 4 copies (4, 4, 4, 4), each fed by the row it is in'
    );
  });
});
