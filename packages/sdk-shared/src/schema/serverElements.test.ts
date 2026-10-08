import { describe, expect, it } from 'vitest';

import {
  collectServerElements,
  hasServerElements,
  notFoundProvider,
  pageServerContext,
  pageSeoText
} from './serverElements';

import type { Element, Schema } from '../types';

const element = (id: string, items: string[] = [], runtime?: 'server' | 'client'): Element => ({
  id,
  attributes: {},
  definition: { type: id, label: id, rootId: 'root', items, styleSelectors: { base: '' }, runtime }
});

const schema = {
  flat: {
    home: element('home', ['homeBox']),
    homeBox: element('homeBox', ['homeApi']),
    homeApi: element('homeApi', [], 'server'),
    post: element('post', ['postApi', 'postText']),
    postApi: element('postApi', [], 'server'),
    postText: element('postText', [], 'client'),
    loop: element('loop', ['loop'])
  },
  pages: ['home', 'post']
} as unknown as Schema;

describe('collectServerElements', () => {
  it('finds a server element nested under plain containers', () => {
    expect(collectServerElements(schema, 'home').map(e => e.id)).toEqual(['homeApi']);
  });

  it('stays inside the page it was asked about', () => {
    expect(collectServerElements(schema, 'post').map(e => e.id)).toEqual(['postApi']);
  });

  it('narrows to the requested ids', () => {
    expect(collectServerElements(schema, 'post', ['postText']).map(e => e.id)).toEqual([]);
  });

  it('answers nothing for a page it cannot find, or for no page at all', () => {
    expect(collectServerElements(schema, 'ghost')).toEqual([]);
    expect(collectServerElements(schema, undefined)).toEqual([]);
  });

  it('terminates on a schema whose items cycle', () => {
    expect(collectServerElements(schema, 'loop')).toEqual([]);
  });
});

describe('collectServerElements with layouts', () => {
  const shell = (id: string, items: string[], attributes: Record<string, string> = {}): Element => ({
    id,
    attributes,
    definition: { type: 'layoutContainer', label: id, rootId: id, items, styleSelectors: { base: '' } }
  });

  const withShells = {
    flat: {
      // The dashboard's shape: a page inside a section shell, inside the app shell with the sidebar.
      dashboard: {
        ...element('dashboard', ['dashApi']),
        attributes: { layout: 'section', layoutContainer: 'sectionBody' }
      },
      dashApi: element('dashApi', [], 'server'),
      section: shell('section', ['sectionTabs', 'sectionBody'], { layout: 'app', layoutContainer: 'appBody' }),
      sectionTabs: element('sectionTabs', ['tabsApi']),
      tabsApi: element('tabsApi', [], 'server'),
      sectionBody: element('sectionBody'),
      app: shell('app', ['sidebar', 'appBody']),
      sidebar: element('sidebar', ['sidebarApi']),
      sidebarApi: element('sidebarApi', [], 'server'),
      appBody: element('appBody'),
      // A page that names a shell the document does not hold renders without it, and so is walked without it.
      orphan: { ...element('orphan', ['orphanApi']), attributes: { layout: 'nowhere', layoutContainer: 'x' } },
      orphanApi: element('orphanApi', [], 'server')
    },
    pages: ['dashboard', 'orphan']
  } as unknown as Schema;

  // A provider in the sidebar is on every page the sidebar wraps — resolved, or it renders with nothing.
  it('finds the server elements of every shell around the page', () => {
    expect(
      collectServerElements(withShells, 'dashboard')
        .map(e => e.id)
        .sort()
    ).toEqual(['dashApi', 'sidebarApi', 'tabsApi']);
  });

  it('narrows the shells to the requested ids too', () => {
    expect(collectServerElements(withShells, 'dashboard', ['sidebarApi']).map(e => e.id)).toEqual(['sidebarApi']);
  });

  it('ignores a shell the document does not hold', () => {
    expect(collectServerElements(withShells, 'orphan').map(e => e.id)).toEqual(['orphanApi']);
  });

  it('counts a page as consuming server data when only its shell does', () => {
    const onlyShell = {
      flat: {
        ...withShells.flat,
        bare: { ...element('bare'), attributes: { layout: 'app', layoutContainer: 'appBody' } }
      },
      pages: ['bare']
    } as unknown as Schema;

    expect(hasServerElements(onlyShell, 'bare')).toBe(true);
  });
});

describe('hasServerElements', () => {
  it('separates a page that consumes server data from one that does not', () => {
    expect(hasServerElements(schema, 'home')).toBe(true);
    expect(hasServerElements(schema, 'ghost')).toBe(false);
  });
});

/** A server provider that says when its answer means the address shows nothing: the page then answers 404. */
describe('notFoundProvider', () => {
  const provider = (id: string, notFound: unknown): Element => ({
    ...element(id, [], 'server'),
    attributes: { notFound }
  });
  const navigation = { routeParams: { slug: 'gone' }, queryParams: {} };

  it('names the provider whose template is true against its answer', () => {
    const post = provider('post', '{{ source.found == false }}');

    expect(notFoundProvider([post], { post: { found: false } }, navigation)).toBe('post');
    expect(notFoundProvider([post], { post: { found: true } }, navigation)).toBeUndefined();
  });

  it('reads the address too', () => {
    const post = provider('post', '{{ source|filter(p => p.slug == navigation.routeParams.slug)|length == 0 }}');

    expect(notFoundProvider([post], { post: [{ slug: 'here' }] }, navigation)).toBe('post');
    expect(notFoundProvider([post], { post: [{ slug: 'gone' }] }, navigation)).toBeUndefined();
  });

  it('takes only true: a template that does not evaluate, an answer missing, no template — the page is found', () => {
    expect(notFoundProvider([provider('post', 'found == false')], { post: {} }, navigation)).toBeUndefined();
    expect(notFoundProvider([provider('post', '{{ source.found == false }}')], {}, navigation)).toBeUndefined();
    expect(notFoundProvider([provider('post', '')], { post: { found: false } }, navigation)).toBeUndefined();
  });
});

describe('pageSeoText', () => {
  const capsule: Element = {
    ...element('capsule', [], 'server'),
    definition: { ...element('capsule', [], 'server').definition, type: 'apiContainer' }
  };
  const context = pageServerContext(
    [capsule],
    { capsule: { title: 'Montaña nº 37' } },
    {
      routeParams: { slug: 'montana-numero-37' },
      queryParams: {}
    }
  );

  it('reads each server provider by the name its descendants read it by, and the address', () => {
    expect(pageSeoText('{{ apiContainer_capsule.title }} — Shop', context)).toBe('Montaña nº 37 — Shop');
    expect(pageSeoText('Capsule {{ navigation.routeParams.slug }}', context)).toBe('Capsule montana-numero-37');
  });

  it('keeps words as they are written, and gives nothing for a blank one', () => {
    expect(pageSeoText('  About — Shop ', context)).toBe('About — Shop');
    expect(pageSeoText('   ', context)).toBeUndefined();
    expect(pageSeoText(undefined, context)).toBeUndefined();
  });

  it('never gives braces: a template that does not evaluate is nothing', () => {
    expect(pageSeoText('{{ apiContainer_capsule.title ', context)).toBeUndefined();
  });
});
