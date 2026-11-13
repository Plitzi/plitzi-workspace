import { describe, expect, it } from 'vitest';

import { HEAVY_PAGE_BYTES, MANY_ELEMENTS } from './heavyPages';
import { authorSpace, component, container, list, paragraph, specFromSpace, styles, text } from '../../index';

import type { ElementSpec, SpaceSpec } from '../../index';

/** The `heavy-page` suggestions of a space. */
const offered = (spec: SpaceSpec) =>
  authorSpace(spec).suggestions.filter(suggestion => suggestion.code === 'heavy-page');

const CARD = styles('card', { padding: 16 });

const WORDS = 'A plan for a site that sells, with its own domain, analytics, forms and a team of people who edit it. ';

/** A card of a plan, written out by hand: a title, a long description and six lines of what it includes. */
const card = (index: number): ElementSpec =>
  container({
    id: `plan-${String(index)}`,
    class: CARD,
    children: [
      text(`Plan ${String(index)}`, { id: `plan-${String(index)}-title` }),
      paragraph(WORDS.repeat(6), { id: `plan-${String(index)}-about` }),
      ...Array.from({ length: 6 }, (_, line) =>
        text(`${WORDS} (${String(line)})`, { id: `plan-${String(index)}-line-${String(line)}` })
      )
    ]
  });

const space = (body: ElementSpec[]): SpaceSpec => ({
  name: 'Pricing',
  permanentUrl: 'pricing',
  classes: { card: CARD },
  pages: [
    { id: 'home', name: 'Home', slug: '', isDefault: true, body: [text('Hello', { id: 'hello' })] },
    { id: 'pricing', name: 'Pricing', slug: 'pricing', body }
  ]
});

describe('heavy-page, a suggestion', () => {
  it('says a page past the line, its weight, and the shapes written again most by what they weigh', () => {
    const found = offered(space(Array.from({ length: 80 }, (_, index) => card(index))));

    expect(found).toHaveLength(1);
    expect(found[0].elementIds[0]).toBe('pricing');
    expect(found[0].message).toMatch(/^Page "pricing" is \d+ KB of document, past 250 KB/);
    // The cards are the shape: the lines inside each are weighed in it, not named again.
    expect(found[0].message).toContain('"plan-0" ×80');
    expect(found[0].message).not.toContain('plan-0-line');
    expect(found[0].saves).toBeGreaterThan(0);
  });

  it('says nothing of a page under the line, nor of the same page written once as a list', () => {
    expect(offered(space(Array.from({ length: 4 }, (_, index) => card(index))))).toEqual([]);

    const rows = Array.from({ length: 80 }, (_, index) => ({ title: `Plan ${String(index)}`, about: WORDS.repeat(6) }));
    const asList = space([
      list({
        id: 'plans',
        source: 'controlled',
        items: rows,
        children: [text('', { id: 'plan-title', from: 'plans.item.title' })]
      })
    ]);

    expect(JSON.stringify(authorSpace(asList).schema).length).toBeLessThan(HEAVY_PAGE_BYTES * 2);
    expect(offered(asList)).toEqual([]);
  });

  // An app's page is heavy for how many elements it has, not for a shape written again: it says so, and is not told.
  it('is not offered to a page that says it is heavy on purpose, and a misspelt code is refused', () => {
    const heavy = space(Array.from({ length: 80 }, (_, index) => card(index)));
    const said = (quiet: unknown): SpaceSpec => ({
      ...heavy,
      pages: heavy.pages.map(page => (page.id === 'pricing' ? { ...page, quiet: quiet as ['heavy-page'] } : page))
    });

    expect(offered(said(['heavy-page']))).toEqual([]);
    // Kept in the page's document, and read back as written.
    const written = authorSpace(said(['heavy-page']));
    expect(specFromSpace(written).spec.pages.find(page => page.slug === 'pricing')?.quiet).toEqual(['heavy-page']);
    expect(() => authorSpace(said(['heavy-pages']))).toThrow(/heavy-pages/);
  });
});

/** The suggestions of one code. */
const ofCode = (spec: SpaceSpec, code: string) =>
  authorSpace(spec).suggestions.filter(suggestion => suggestion.code === code);

/** `count` short texts, each its own element. */
const texts = (prefix: string, count: number): ElementSpec[] =>
  Array.from({ length: count }, (_, index) => text(`${prefix} ${String(index)}`, { id: `${prefix}-${String(index)}` }));

const onePage = (body: ElementSpec[], extra: Partial<SpaceSpec> = {}): SpaceSpec => ({
  name: 'App',
  permanentUrl: 'app',
  pages: [{ id: 'home', name: 'Home', slug: '', isDefault: true, body }],
  ...extra
});

describe('many-elements, a suggestion', () => {
  it('says a page that builds more than a phone handles well as it opens, and what a visit downloads for it', () => {
    const found = ofCode(onePage(texts('row', MANY_ELEMENTS + 100)), 'many-elements');

    expect(found).toHaveLength(1);
    expect(found[0].message).toMatch(/^Page "home" builds 1,60\d elements as it opens, past 1,500:/);
    expect(found[0].message).toMatch(
      /A visit downloads \d+ KB of document for them — \d+(\.\d)? (MB|GB) for every 10,000 visits/
    );
  });

  it('says nothing under the line', () => {
    expect(ofCode(onePage(texts('row', MANY_ELEMENTS - 100)), 'many-elements')).toEqual([]);
  });

  it('counts its layout’s elements with its own, and says how many are whose', () => {
    const spec = onePage([container({ id: 'body', children: texts('row', 900) })], {
      layouts: [
        {
          id: 'shell',
          label: 'Shell',
          body: [container({ id: 'nav', children: texts('link', 700) }), container({ id: 'slot' })]
        }
      ],
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          isDefault: true,
          layout: { id: 'shell', slot: 'slot' },
          body: [container({ id: 'body', children: texts('row', 900) })]
        }
      ]
    });
    const found = ofCode(spec, 'many-elements');

    expect(found).toHaveLength(1);
    expect(found[0].message).toMatch(/\(90\d of its own, 70\d of layout "shell"\)/);
  });

  it('counts a component once per instance placed', () => {
    const spec = onePage(
      Array.from({ length: 80 }, (_, index) => component('card', { id: `card-${String(index)}` })),
      { components: [{ id: 'card', root: container({ id: 'card-root', children: texts('line', 19) }) }] }
    );

    expect(ofCode(spec, 'many-elements')).toHaveLength(1);
  });

  // A tab or a panel that starts hidden and is built when first shown costs the page nothing as it opens.
  it('leaves out what starts hidden and waits to be shown, and names what starts hidden but is built all the same', () => {
    const panel = (loadStrategy?: 'lazy') =>
      onePage([
        ...texts('row', 400),
        container({
          id: 'details',
          visible: false,
          ...(loadStrategy ? { loadStrategy } : {}),
          children: texts('detail', 1_300)
        })
      ]);

    expect(ofCode(panel('lazy'), 'many-elements')).toEqual([]);
    const eager = ofCode(panel(), 'many-elements');
    expect(eager).toHaveLength(1);
    expect(eager[0].message).toContain('Built though they start hidden: "details" (1,300)');
    expect(eager[0].message).toContain("`loadStrategy: 'lazy'` builds each the first time it is shown");
    expect(eager[0].elementIds).toEqual(['home', 'details']);
  });

  // Pizarra's workspace: hidden until its board is read, which the server does for the first paint — lazy saves nothing.
  it('does not name for deferring what a condition shows, which may be on screen at once', () => {
    const found = ofCode(
      onePage([
        container({
          id: 'workspace',
          visible: { source: 'state.boardId', template: "{{ source != '' }}" },
          children: texts('tool', MANY_ELEMENTS + 100)
        })
      ]),
      'many-elements'
    );

    expect(found).toHaveLength(1);
    expect(found[0].message).not.toContain('Built though they start hidden');
    expect(found[0].elementIds).toEqual(['home']);
  });
});

describe('heavy-layout, a suggestion', () => {
  const layoutWith = (cards: number): SpaceSpec => ({
    name: 'Pricing',
    permanentUrl: 'pricing',
    classes: { card: CARD },
    layouts: [
      {
        id: 'shell',
        label: 'Shell',
        body: [
          container({ id: 'aside', children: Array.from({ length: cards }, (_, index) => card(index)) }),
          container({ id: 'slot' })
        ]
      }
    ],
    pages: ['home', 'about'].map((id, index) => ({
      id,
      name: id,
      slug: index === 0 ? '' : id,
      ...(index === 0 ? { isDefault: true } : {}),
      layout: { id: 'shell', slot: 'slot' },
      body: [text(id, { id: `${id}-title` })]
    }))
  });

  // Its two pages and the not-found page authoring writes (`*`), drawn in the same shell.
  it('says a layout past the line, and how many pages are downloaded with it', () => {
    const found = ofCode(layoutWith(80), 'heavy-layout');

    expect(found).toHaveLength(1);
    expect(found[0].message).toMatch(
      /^Layout "shell" is \d+ KB of document, past 250 KB: each of its 3 pages is downloaded with it/
    );
    expect(found[0].elementIds).toEqual(['shell']);
  });

  it('says nothing of a light one', () => {
    expect(ofCode(layoutWith(4), 'heavy-layout')).toEqual([]);
  });
});
