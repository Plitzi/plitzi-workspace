import { describe, expect, it } from 'vitest';

import { missingParts, schemaForPage, splitSchema, withParts } from './documentParts';

import type { Element, Schema } from '../types';

// Fixtures: an element and a schema with the fields the split reads; the rest of each type is no concern of it.
const el = (
  id: string,
  rootId: string,
  type: string,
  items: string[] = [],
  attributes: Record<string, unknown> = {}
): Element => ({ id, attributes, definition: { type, label: id, rootId, items, styleSelectors: { base: '' } } });

/**
 * A site: two public pages in one shell layout, an admin page in a console layout nested in it, and an element of
 * `about` copied onto `home` by a reference.
 */
const schema = (): Schema =>
  ({
    flat: {
      site: el('site', 'site', 'layoutContainer', ['site-nav', 'site-slot']),
      'site-nav': el('site-nav', 'site', 'container'),
      'site-slot': el('site-slot', 'site', 'container'),
      console: el('console', 'console', 'layoutContainer', ['console-bar'], {
        layout: 'site',
        layoutContainer: 'site-slot'
      }),
      'console-bar': el('console-bar', 'console', 'container'),
      home: el('home', 'home', 'page', ['home-hero', 'home-copy'], { layout: 'site', layoutContainer: 'site-slot' }),
      'home-hero': el('home-hero', 'home', 'text'),
      'home-copy': el('home-copy', 'home', 'reference', [], { referenceId: 'about-team' }),
      about: el('about', 'about', 'page', ['about-team'], { layout: 'site', layoutContainer: 'site-slot' }),
      'about-team': el('about-team', 'about', 'container', ['about-name']),
      'about-name': el('about-name', 'about', 'text'),
      admin: el('admin', 'admin', 'page', ['admin-table'], { layout: 'console', layoutContainer: 'console' }),
      'admin-table': el('admin-table', 'admin', 'container')
    },
    pages: ['home', 'about', 'admin'],
    pageFolders: [],
    components: {},
    definition: { name: 'Site', permanentUrl: 'site' },
    variables: [],
    settings: {}
  }) as unknown as Schema;

const nameOf = (part: { root: string }): string => `part-${part.root}`;

describe('a space sent in parts', () => {
  it('keeps every page and layout in the shell, and their elements in a part each', () => {
    const { shell, parts } = splitSchema(schema(), nameOf);

    expect(Object.keys(shell.flat).sort()).toEqual(['about', 'admin', 'console', 'home', 'site']);
    expect(shell.parts).toEqual({
      site: 'part-site',
      console: 'part-console',
      home: 'part-home',
      about: 'part-about',
      admin: 'part-admin'
    });
    expect(Object.keys(parts.get('part-site')?.flat ?? {})).toEqual(['site-slot', 'site-nav']);
  });

  it('gives a page what it copies from another page, with what is under it', () => {
    const { parts } = splitSchema(schema(), nameOf);

    expect(Object.keys(parts.get('part-home')?.flat ?? {}).sort()).toEqual([
      'about-name',
      'about-team',
      'home-copy',
      'home-hero'
    ]);
  });

  it('puts back the whole space from the shell and every part', () => {
    const whole = schema();
    const { shell, parts } = splitSchema(whole, nameOf);

    expect(withParts(shell, [...parts.values()])).toEqual(whole);
  });

  it('sends with a page its own part and its layouts’, innermost first, and nothing else', () => {
    const split = splitSchema(schema(), nameOf);
    const page = schemaForPage(split, 'admin');

    expect(Object.keys(page.flat)).toEqual(expect.arrayContaining(['admin-table', 'console-bar', 'site-nav']));
    expect(page.flat['home-hero']).toBeUndefined();
    expect(page.parts).toEqual({ home: 'part-home', about: 'part-about' });
    expect(missingParts(page, 'about')).toEqual(['about']);
    expect(missingParts(page, 'admin')).toEqual([]);
  });

  it('names a layout only withheld pages are drawn in as not this visitor’s, and sends none of it', () => {
    const withheld = schema();
    withheld.flat.admin = { ...withheld.flat.admin, definition: { ...withheld.flat.admin.definition, items: [] } };
    delete withheld.flat['admin-table'];
    const { shell, parts } = splitSchema(withheld, nameOf, ['admin']);

    expect(shell.parts?.console).toBe('');
    expect(shell.flat['console-bar']).toBeUndefined();
    expect([...parts.values()].some(part => Object.hasOwn(part.flat, 'console-bar'))).toBe(false);
    expect(missingParts(shell, 'admin')).toEqual(['console', 'site']);
  });

  it('sends with a page the pages at its address, which the router changes to as somebody signs in or out', () => {
    const space = schema();
    space.flat.account = el('account', 'account', 'page', ['account-name'], {
      slug: 'about',
      layout: 'site',
      layoutContainer: 'site-slot'
    });
    space.flat['account-name'] = el('account-name', 'account', 'text');
    space.flat.about = { ...space.flat.about, attributes: { ...space.flat.about.attributes, slug: 'about' } };
    space.pages = [...space.pages, 'account'];
    const page = schemaForPage(splitSchema(space, nameOf), 'about');

    expect(page.flat['account-name']).toBeDefined();
    expect(page.parts?.account).toBeUndefined();
  });

  it('does not count a page at its address withheld from this visitor, so a guest’s link to it is followed here', () => {
    const space = schema();
    // The signed-in page at `about`'s address, in the console, withheld from this guest — as the console's other page is.
    space.flat.account = el('account', 'account', 'page', [], {
      slug: 'about',
      layout: 'console',
      layoutContainer: 'console'
    });
    space.flat.about = { ...space.flat.about, attributes: { ...space.flat.about.attributes, slug: 'about' } };
    space.flat.admin = { ...space.flat.admin, definition: { ...space.flat.admin.definition, items: [] } };
    delete space.flat['admin-table'];
    space.pages = [...space.pages, 'account'];
    const { shell } = splitSchema(space, nameOf, ['admin', 'account']);

    expect(shell.parts?.console).toBe('');
    expect(missingParts(shell, 'about')).toEqual(['about', 'site']);
    expect(missingParts(shell, 'account')).toEqual(['console', 'site', 'about']);
  });

  it('leaves a document with nothing to split as it came, and one without parts untouched', () => {
    const whole = schema();

    expect(withParts(whole, [])).toBe(whole);
    expect(missingParts(whole, 'home')).toEqual([]);
  });
});
