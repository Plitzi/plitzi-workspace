import { describe, expect, it } from 'vitest';

import {
  actionSource,
  apiContainer,
  authorSpace,
  bindTemplate,
  heading,
  hiddenWhen,
  list,
  scope,
  source,
  text,
  twig,
  variantFrom
} from '../index';

import type { ElementSpec, SpaceSpec } from '../schema';

const home = {
  hero: { title: 'Welcome', subtitle: 'Hi' },
  grid: [
    { title: 'One', price: 10 },
    { title: 'Two', badge: 'new' }
  ],
  total: 2
};

const page = (body: ElementSpec[]): SpaceSpec => ({
  name: 'Typed',
  permanentUrl: 'typed',
  pages: [{ id: 'home', name: 'Home', slug: '', body }]
});

describe('source', () => {
  const site = source('site', home);

  it('is the full name of whatever it leads to, in a field and in a template alike', () => {
    expect(site.id).toBe('site');
    expect(String(site.data.hero.title)).toBe('apiContainer_site.data.hero.title');
    expect(twig`{{ ${site.data.total} + ${1} }}`).toBe('{{ apiContainer_site.data.total + 1 }}');
    expect(String(site.data.grid[1].title)).toBe('apiContainer_site.data.grid.1.title');
    expect(JSON.stringify({ at: site.data.total })).toBe('{"at":"apiContainer_site.data.total"}');
  });

  it('writes the document a name written by hand writes', () => {
    const typed = authorSpace(
      page([
        apiContainer({
          id: site.id,
          query: '/data/home.json',
          children: [
            heading({ from: site.data.hero.title }),
            text({ bind: { content: site.data.hero.subtitle } }),
            list({ id: 'grid', items: site.data.grid, row: g => text({ from: g.item.title }) })
          ]
        })
      ])
    );
    const byHand = authorSpace(
      page([
        apiContainer({
          id: 'site',
          query: '/data/home.json',
          children: [
            heading({ from: 'site.data.hero.title' }),
            text({ bind: { content: 'site.data.hero.subtitle' } }),
            list({ id: 'grid', items: 'site.data.grid', row: r => text({ from: `${r.inTemplate.item}.title` }) })
          ]
        })
      ])
    );

    expect(typed.schema).toEqual(byHand.schema);
  });

  it('types a row from the sample, every item read as one', () => {
    const row = list({ id: 'grid', items: site.data.grid, row: g => text({ from: g.item.badge }) });

    expect(row.children?.[0].from).toBe('list_grid.item.badge');
  });

  /** A list turned typed keeps every template its rows were written with, and its paths go wherever a name does. */
  it('hands a typed row the names an untyped one has, and its paths to a binding', () => {
    const row = list({
      id: 'grid',
      items: site.data.grid,
      row: g =>
        text({
          content: `{{ ${g.inTemplate.item}.title }}`,
          bind: [bindTemplate('title', g.item.title, '{{ source|upper }}'), hiddenWhen(g.item.badge)]
        })
    });

    expect(row.children?.[0]).toMatchObject({
      attributes: { content: '{{ list_grid.item.title }}' },
      bind: [
        { to: 'title', source: 'list_grid.item.title' },
        { to: 'visibility', source: 'list_grid.item.badge' }
      ]
    });
    expect(variantFrom('pill', site.data.total).source).toBe('apiContainer_site.data.total');
  });

  it('refuses a field the sample does not have, where the types were not looking', () => {
    // @ts-expect-error -- `titel` is not in the sample.
    expect(() => String(site.data.hero.titel)).toThrow(/\[source-field-unknown\].*did you mean "title"/s);
    // @ts-expect-error -- a text has no fields.
    expect(() => String(site.data.hero.title.length)).toThrow(/is a string in the sample/);
    expect(() => String(Reflect.get(site.data.grid, 'first'))).toThrow(/a list, read by position/);
  });

  it('takes the scope it is made in, as the element does', () => {
    const scoped = scope('promo', () => source('site', home));

    expect(scoped.id).toBe('promo-site');
    expect(String(scoped.data.total)).toBe('apiContainer_promo-site.data.total');
  });
});

/**
 * A provider fed by a server action publishes the output at its root — the shape `source` cannot say, since it puts
 * every answer under `data`. Typed by a sample of the output, `.data` is a type error, as any field the output lacks.
 */
describe('actionSource', () => {
  const feed = actionSource('feed', { stories: [{ id: 'a', title: 'Hello' }], updatedAt: '' });

  it('reads the output at the provider’s root, beside its state', () => {
    expect(String(feed.stories[0].title)).toBe('apiContainer_feed.stories.0.title');
    expect(String(feed.isLoading)).toBe('apiContainer_feed.isLoading');
  });

  it('refuses the query provider’s `data`, which the output does not have', () => {
    // @ts-expect-error -- an action's provider has no `data` unless its output does.
    expect(() => String(feed.data)).toThrow(/\[source-field-unknown\]/);
  });

  it('authors a page reading it with no warning', () => {
    const { warnings } = authorSpace(
      page([
        apiContainer({
          id: feed.id,
          subType: 'section',
          runtime: 'server',
          action: 'world-report',
          children: [text({ content: twig`{{ ${feed.stories}|length }} stories` })]
        })
      ])
    );

    expect(warnings).toEqual([]);
  });
});

describe('a read of `.data` on an action’s provider', () => {
  const author = (content: string, bind?: Record<string, string>) =>
    authorSpace(
      page([
        apiContainer({
          id: 'feed',
          subType: 'section',
          runtime: 'server',
          action: 'world-report',
          children: [text({ content, ...(bind ? { bind } : {}) })]
        })
      ])
    ).warnings.filter(warning => warning.code === 'action-output-path');

  it('is warned with the path that reads the output, in a template and in a binding', () => {
    const [inTemplate] = author('{{ apiContainer_feed.data.stories|length }}');
    expect(inTemplate.message).toContain('`apiContainer_feed.stories`');

    const [inBinding] = author('', { content: 'feed.data.title' });
    expect(inBinding.message).toContain('`apiContainer_feed.title`');
  });

  it('is not warned for the output read at its root, nor for a query provider’s `data`', () => {
    expect(author('{{ apiContainer_feed.stories|length }}')).toEqual([]);

    const { warnings } = authorSpace(
      page([
        apiContainer({
          id: 'site',
          query: '/data/site.json',
          subType: 'section',
          children: [text({ content: '{{ apiContainer_site.data.title }}' })]
        })
      ])
    );
    expect(warnings.filter(warning => warning.code === 'action-output-path')).toEqual([]);
  });
});
