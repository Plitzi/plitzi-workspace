import { describe, it, expect } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { buildTypeRegistry, readResource, resourceErrorMessage } from '../resources';
import { apply, read, search } from '../tools';

import type {
  AIDefinition,
  AIElementDetail,
  AIPageSkeleton,
  AIPageStyles,
  AIPageSummary,
  AISchemaVariable,
  AIStyleVariable
} from '../types';
import type { Schema } from '@plitzi/sdk-shared';

describe('mcp-ai reads (filesystem model)', () => {
  it('derives element types from the observed space, never invented', () => {
    const reg = buildTypeRegistry(buildSpace().schema);
    expect(Object.keys(reg.types).sort()).toEqual(['container', 'page']);
    expect(reg.types.container.slots).toEqual(['base']);
    expect(reg.types.container.subTypes).toEqual(['div']);
    expect(reg.styleVariableCategories).toEqual(['color', 'spacing', 'shadow', 'custom']);
  });

  it('enriches built-in types with curated label/description/category and source', () => {
    const reg = buildTypeRegistry(buildSpace().schema);
    expect(reg.types.container.source).toBe('builtin');
    expect(reg.types.container.label).toBe('Container');
    expect(reg.types.container.category).toBe('structure');
    expect(reg.types.container.description).toContain('layout box');
    expect(reg.types.page.source).toBe('builtin');
  });

  it('enriches plugin types from the component catalog and falls back to observed label otherwise', () => {
    const schema = {
      flat: {
        p: {
          id: 'p',
          attributes: {},
          definition: { rootId: 'p', label: 'Page', type: 'page', items: ['w', 'u'], styleSelectors: { base: '' } }
        },
        w: {
          id: 'w',
          attributes: {},
          definition: {
            rootId: 'p',
            parentId: 'p',
            label: 'Fancy Chart',
            type: 'chartWidget',
            items: [],
            styleSelectors: { base: '' }
          }
        },
        u: {
          id: 'u',
          attributes: {},
          definition: {
            rootId: 'p',
            parentId: 'p',
            label: 'Mystery',
            type: 'legacyThing',
            items: [],
            styleSelectors: { base: '' }
          }
        }
      },
      definition: { name: 'T', permanentUrl: '' },
      variables: [],
      settings: { customCss: '' },
      pages: ['p'],
      pageFolders: []
    } as unknown as Schema;
    const catalog = {
      chartWidget: {
        custom: true,
        label: 'Chart Widget',
        description: 'Renders a chart from a data source',
        category: 'plugin'
      }
    };

    const reg = buildTypeRegistry(schema, catalog);
    expect(reg.types.chartWidget.source).toBe('plugin');
    expect(reg.types.chartWidget.label).toBe('Chart Widget');
    expect(reg.types.chartWidget.description).toBe('Renders a chart from a data source');
    expect(reg.types.legacyThing.source).toBe('unknown');
    expect(reg.types.legacyThing.label).toBe('Mystery');
    expect(reg.types.legacyThing.description).toBeUndefined();
  });

  it('surfaces a type intrinsic base default style so an agent does not assume display:block', () => {
    const reg = buildTypeRegistry(buildSpace().schema, {
      text: { custom: false, attributes: ['content'], defaultStyle: { display: 'inline', 'font-size': '14px' } },
      container: { custom: false, attributes: [] }
    });
    expect(reg.types.text.defaultStyle).toEqual({ display: 'inline', 'font-size': '14px' });
    expect(reg.types.container.defaultStyle).toBeUndefined();
  });

  it('lists pages as cheap summaries without element trees', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages');
    const pages = res?.data as AIPageSummary[];
    expect(res?.stateVersion).toMatch(/^[a-f0-9]{12}$/);
    expect(pages[0]).toMatchObject({ ref: 'home', label: 'Home', default: true, elementCount: 1 });
    expect(pages[0]).not.toHaveProperty('tree');
  });

  it('reads one page as a skeleton tree (class refs, no props/CSS)', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages/home');
    const page = res?.data as AIPageSkeleton;
    expect(page.tree[0]).toMatchObject({
      ref: 'c1',
      type: 'container',
      label: 'Container',
      subType: 'div',
      childCount: 0,
      base: ['box']
    });
    expect(page.tree[0]).not.toHaveProperty('props');
  });

  it('skeleton node stateVersion equals a direct element read (so cached versions can be diffed)', () => {
    const space = buildSpace();
    const node = (readResource(space, 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton).tree[0];
    const el = readResource(space, 'main', 'plitzi://schema/main/elements/c1');
    expect(node.stateVersion).toBe(el?.stateVersion);
  });

  it('page stateVersion aggregates the tree: it changes when a descendant changes', async () => {
    const original = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages/home')?.stateVersion;
    const cap = capturing(buildSpace());
    await apply(
      { operations: [{ type: 'patchElement', pageRef: 'home', ref: 'c1', props: { title: 'Renamed' } }] },
      buildSpace(),
      cap.persisters
    );
    const after = readResource(cap.saved(), 'main', 'plitzi://schema/main/pages/home');
    const node = (after?.data as AIPageSkeleton).tree[0];
    const el = readResource(cap.saved(), 'main', 'plitzi://schema/main/elements/c1');
    expect(after?.stateVersion).not.toBe(original);
    expect(node.stateVersion).toBe(el?.stateVersion);
  });

  it('reads one element in full detail on demand', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/elements/c1');
    const el = res?.data as AIElementDetail;
    expect(el).toMatchObject({ ref: 'c1', type: 'container', pageRef: 'home', parentRef: 'home' });
    expect(el.props).toEqual({ title: 'Box' });
    expect(el.style.base).toEqual(['box']);
  });

  it('lists definition refs, and reads one definition on demand', () => {
    const list = readResource(buildSpace(), 'main', 'plitzi://definitions/main')?.data as string[];
    expect(list).toEqual(['box']);

    const box = readResource(buildSpace(), 'main', 'plitzi://definitions/main/box')?.data as AIDefinition;
    expect(box.desktop).toEqual({ display: 'flex' });
    expect(box.variants?.lg.desktop).toEqual({ 'font-size': '50px' });
  });

  it('reads style variables with theme values and var(--name) reference', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://style-variables/main');
    const colors = (res?.data as Record<string, AIStyleVariable[]>).color;
    expect(colors[0]).toEqual({
      name: 'foreground',
      reference: 'var(--foreground)',
      value: { light: '#000', dark: '#fff', default: '#000' }
    });
  });
});

describe('mcp-ai page skeleton route params', () => {
  it('exposes route params derived from the slug', () => {
    const sk = readResource(
      (() => {
        const s = buildSpace();
        (s.schema.flat.page1.attributes as Record<string, unknown>).slug = ':spaceId';

        return s;
      })(),
      'main',
      'plitzi://schema/main/pages/spaceid'
    )?.data as AIPageSkeleton;
    expect(sk.routeParams).toEqual(['spaceId']);
  });

  it('is an empty list for a static page', () => {
    const sk = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages/home')?.data as AIPageSkeleton;
    expect(sk.routeParams).toEqual([]);
  });
});

describe('mcp-ai page styles resource (all styles a page uses in one read)', () => {
  it('collects the class definitions the page elements attach, deduplicated and with CSS', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/pages/home/styles');
    const styles = res?.data as AIPageStyles;
    expect(styles.ref).toBe('home');
    expect(styles.definitions.find(d => d.ref === 'box')?.desktop).toEqual({ display: 'flex' });
    expect(styles.definitions.every(d => d.ref !== 'page-x')).toBe(true);
  });

  it('includes the global styles affecting any element type on the page', () => {
    const space = buildSpace();
    space.style.platform.desktop.containerGlobal = {
      name: 'containerGlobal',
      type: 'element',
      componentType: 'container',
      attributes: { base: { default: { 'box-sizing': 'border-box' } } },
      cache: ''
    } as unknown as (typeof space.style.platform)['desktop'][string];
    const styles = readResource(space, 'main', 'plitzi://schema/main/pages/home/styles')?.data as AIPageStyles;
    expect(styles.globalStyles.find(g => g.ref === 'containerGlobal')?.appliesToType).toBe('container');
  });
});

describe('mcp-ai batch read (many uris in one call)', () => {
  it('reads several uris at once, returning data or a teachable error per uri', () => {
    const res = read(
      { uris: ['plitzi://schema/main/elements/c1', 'plitzi://schema/main/elements/does-not-exist'] },
      buildSpace(),
      'main'
    );
    expect(res.results[0].stateVersion).toMatch(/^[a-f0-9]{12}$/);
    expect((res.results[0].data as AIElementDetail).ref).toBe('c1');
    expect(res.results[1].data).toBeUndefined();
    expect(res.results[1].error).toBe('NOT_FOUND');
  });

  it('flags a malformed uri without failing the whole batch', () => {
    const res = read({ uris: ['not-a-real-uri', 'plitzi://schema/main/elements/c1'] }, buildSpace(), 'main');
    expect(res.results[0].error).toBe('MALFORMED_URI');
    expect((res.results[1].data as AIElementDetail).ref).toBe('c1');
  });
});

describe('mcp-ai slim primer (cold-start payload)', () => {
  it('drops schema-variable subValues (kept only on the dedicated resource)', () => {
    const primer = readResource(buildSpace(), 'main', 'plitzi://primer/main')?.data as {
      schemaVariables: Record<string, AISchemaVariable>;
    };
    expect(primer.schemaVariables.apiUrl.value).toBe('https://api');
    expect(primer.schemaVariables.apiUrl.subValues).toBeUndefined();
    const dedicated = readResource(buildSpace(), 'main', 'plitzi://schema-variables/main')?.data as Record<
      string,
      AISchemaVariable
    >;
    expect(dedicated.apiUrl.subValues).toEqual([]);
  });

  it('excludes oversized prop values (e.g. base64 blobs) from type-registry examples', () => {
    const space = buildSpace();
    space.schema.flat.c1.attributes.contentCache = 'x'.repeat(500);
    const reg = buildTypeRegistry(space.schema);
    expect(reg.types.container.props.contentCache.valueTypes).toEqual(['string']);
    expect(reg.types.container.props.contentCache.examples).toEqual([]);
  });
});

describe('mcp-ai resolved style inlined in element detail (RFC 0005 #1)', () => {
  it('inlines the CSS of each attached definition under resolvedStyle', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://schema/main/elements/c1');
    const el = res?.data as AIElementDetail;
    expect(el.resolvedStyle?.box.desktop).toEqual({ display: 'flex' });
    expect(el.resolvedStyle?.box.variants?.lg.desktop).toEqual({ 'font-size': '50px' });
  });

  it('omits resolvedStyle when the attached class resolves to no definition', () => {
    const space = buildSpace();
    space.schema.flat.c1.definition.styleSelectors.base = 'not-a-definition';
    const el = readResource(space, 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.resolvedStyle).toBeUndefined();
  });

  it('lists the global element selectors that affect the element by its type', () => {
    const space = buildSpace();
    space.style.platform.desktop.containerGlobal = {
      name: 'containerGlobal',
      type: 'element',
      componentType: 'container',
      attributes: { base: { default: { 'box-sizing': 'border-box' } } },
      cache: ''
    } as unknown as (typeof space.style.platform)['desktop'][string];
    const el = readResource(space, 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.globalStyles?.[0]).toMatchObject({
      ref: 'containerGlobal',
      appliesToType: 'container',
      desktop: { 'box-sizing': 'border-box' }
    });
  });

  it('omits globalStyles when no global selector targets the element type', () => {
    const el = readResource(buildSpace(), 'main', 'plitzi://schema/main/elements/c1')?.data as AIElementDetail;
    expect(el.globalStyles).toBeUndefined();
  });

  it('search include:"detail" carries resolvedStyle and its version matches a direct element read', () => {
    const withDetail = search({ query: 'box', include: 'detail' }, buildSpace(), 'main');
    const hit = withDetail.results.find(r => r.ref === 'c1');
    expect(hit?.detail?.resolvedStyle?.box.desktop).toEqual({ display: 'flex' });
    const read = readResource(buildSpace(), 'main', 'plitzi://schema/main/elements/c1');
    expect(hit?.stateVersion).toBe(read?.stateVersion);
  });
});

describe('mcp-ai URI aliases under schema root (RFC 0005 #3/#4)', () => {
  it('resolves a definition through the plitzi://schema/{env}/definitions/{ref} alias', () => {
    const canonical = readResource(buildSpace(), 'main', 'plitzi://definitions/main/box');
    const alias = readResource(buildSpace(), 'main', 'plitzi://schema/main/definitions/box');
    expect(alias?.data).toEqual(canonical?.data);
  });

  it('resolves the definitions listing through the alias root', () => {
    const alias = readResource(buildSpace(), 'main', 'plitzi://schema/main/definitions')?.data as string[];
    expect(alias).toEqual(['box']);
  });

  it('reports a not-found (not malformed) alias whose ref does not resolve', () => {
    const parsed = JSON.parse(resourceErrorMessage('main', 'plitzi://schema/main/definitions/ghost')) as {
      error: string;
    };
    expect(parsed.error).toBe('NOT_FOUND');
  });
});

describe('mcp-ai primer bootstrap (R4)', () => {
  it('bundles guide, types, css and summaries in one read', () => {
    const res = readResource(buildSpace(), 'main', 'plitzi://primer/main');
    const primer = res?.data as {
      guide: string;
      types: { types: Record<string, unknown> };
      cssProperties: string[];
      pages: AIPageSummary[];
      definitions: string[];
    };
    expect(primer.guide).toContain('quickstart');
    expect(primer.guide).toContain('plitzi://guide');
    expect(Object.keys(primer.types.types).sort()).toEqual(['container', 'page']);
    expect(primer.cssProperties.length).toBeGreaterThan(0);
    expect(primer.pages[0].ref).toBe('home');
    expect(primer.definitions).toContain('box');
    expect(primer.pages[0]).not.toHaveProperty('tree');
  });
});

describe('mcp-ai resource error messages (I2)', () => {
  it('teaches valid templates for a malformed URI shape', () => {
    const msg = resourceErrorMessage('main', 'plitzi://schema/main/element/home/c1');
    const parsed = JSON.parse(msg) as { error: string; validTemplates: string[] };
    expect(parsed.error).toBe('MALFORMED_URI');
    expect(parsed.validTemplates).toContain('plitzi://schema/main/elements/{ref}');
  });

  it('flags a well-formed URI whose ref does not resolve as not-found', () => {
    const parsed = JSON.parse(resourceErrorMessage('main', 'plitzi://schema/main/elements/ghost')) as {
      error: string;
    };
    expect(parsed.error).toBe('NOT_FOUND');
  });
});
