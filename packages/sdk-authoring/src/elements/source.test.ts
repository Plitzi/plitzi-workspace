import { describe, expect, it } from 'vitest';

import { apiContainer, authorSpace, heading, list, scope, source, text, twig } from '../index';

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
