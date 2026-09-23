import { describe, expect, it } from 'vitest';

import { collectServerElements, hasServerElements } from './serverElements';

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
