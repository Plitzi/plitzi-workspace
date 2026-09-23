/* eslint-disable quotes */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { apiContainer, button, container, heading, text } from '../elements';
import { authorSpace } from '../index';
import { blankSpaceSpec } from '../spaces';
import { styles } from '../style';
import { compareSpaces } from './compareSpaces';
import { specFromSpace } from './specFromSpace';
import { specToSource } from './specToSource';

import type { ElementSpec, PageSpec, SpaceDocuments, SpaceSpec } from '../schema';
import type { StyleItem } from '@plitzi/sdk-shared';

const card = styles('card', {
  css: { padding: '24px', 'border-radius': '12px' },
  states: { hover: { 'background-color': 'var(--accent)' } },
  variants: { active: { 'font-weight': '700' } }
});

/** A space that uses every part of the surface the reader has to give back. */
const rich: SpaceSpec = {
  name: 'Rich',
  permanentUrl: 'rich',
  variables: { color: { accent: { light: '#eee', dark: '#222', default: '#eee' } } },
  elements: {
    heading: { base: { color: 'var(--accent)' }, variants: { title: { 'margin-top': '0px' } } },
    modalContainer: { slots: { rootContainer: { 'background-color': 'white' } } }
  },
  classes: { unused: { color: 'red' } },
  settings: { keepState: true, stateStorage: 'localStorage' },
  customCss: '.card .title { outline: 1px solid; }',
  pageFolders: [{ id: 'docs', name: 'Docs' }],
  layouts: [
    {
      id: 'shell',
      label: 'Shell',
      css: { display: 'flex' },
      body: [container({ id: 'nav', states: { hover: { opacity: '0.9' } } }), container({ id: 'slot' })]
    }
  ],
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      isDefault: true,
      seoTitle: 'Home',
      layout: { id: 'shell', slot: 'slot' },
      css: { 'min-height': '100vh' },
      body: [
        apiContainer({ id: 'posts', endpoint: '/posts' }),
        heading('Hello', { subType: 'h1', bind: { content: 'posts.title' }, variant: 'title' }),
        container({ class: card, children: [text('a')] }),
        container({ class: card, visible: false }),
        text('maybe', {
          visible: '!posts.loading',
          bind: [{ to: 'className', source: 'state.theme', transformers: [{ action: 'not', params: {} }] }]
        }),
        button('Go', {
          id: 'go',
          flows: [
            [
              { type: 'trigger', action: 'onClick' },
              { id: 'call', type: 'utility', action: 'webHook', params: { url: '/x' } },
              { type: 'globalCallback', action: 'navigate', on: 'navigation', params: { url: '{{ call.response }}' } }
            ]
          ]
        })
      ]
    },
    { id: 'guide', name: 'Guide', slug: 'guide', folder: 'docs', keepState: true, body: [] }
  ]
};

const roundTrip = (spec: SpaceSpec): { first: SpaceDocuments; second: SpaceDocuments } => {
  const first = authorSpace(spec);
  const { spec: read, corrections } = specFromSpace(first);

  expect(corrections).toEqual([]);

  return { first, second: authorSpace(read) };
};

describe('specFromSpace', () => {
  it('reads an authored space back into a spec that authors the same space', () => {
    const { first, second } = roundTrip(rich);

    expect(compareSpaces(first, second)).toEqual([]);
  });

  it('round-trips the blank space every account starts with', () => {
    const { first, second } = roundTrip(blankSpaceSpec);

    expect(compareSpaces(first, second)).toEqual([]);
  });

  it('keeps a name something refers to, and leaves out one nothing does', () => {
    const { spec } = specFromSpace(authorSpace(rich));
    const body = spec.pages[0].body;

    expect(body[0].id).toBe('posts');
    expect(body[1].id).toBeUndefined();
    expect(body[1].bind).toEqual({ content: 'posts.title' });
  });

  it('keeps every id when asked, for a space people keep working in', () => {
    const { spec } = specFromSpace(authorSpace(rich), { keepIds: true });

    expect(spec.pages[0].body[1].id).toBe('heading-1');
  });

  it('writes a selector one element uses into that element, and keeps a shared one as a class', () => {
    const { spec } = specFromSpace(authorSpace(rich));

    expect(spec.pages[0].css).toEqual({ 'min-height': '100vh' });
    expect(spec.pages[0].body[2].class).toBe('card');
    expect(spec.classes?.card).toMatchObject({ states: { hover: { 'background-color': 'var(--accent)' } } });
    expect(spec.classes?.unused).toEqual({ color: 'red' });
  });

  it('writes the longhands a document stores back as the shorthand, where every side agrees', () => {
    const { spec } = specFromSpace(authorSpace(rich));

    expect(spec.classes?.card).toMatchObject({ css: { padding: '24px', 'border-radius': '12px' } });
  });

  it('uses the shortest box notation, and leaves a value with a space in it written out', () => {
    const documents = authorSpace({
      name: 'Boxes',
      permanentUrl: 'boxes',
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          body: [
            container({ id: 'pair', css: { padding: '10px 20px', gap: '4px 8px' } }),
            container({ id: 'three', css: { margin: '1px 2px 3px' } }),
            container({ id: 'calc', css: { padding: 'calc(1px + 2px)' } })
          ]
        }
      ]
    });
    const [pair, three, calc] = specFromSpace(documents).spec.pages[0].body;

    expect(pair.css).toEqual({ padding: '10px 20px', gap: '4px 8px' });
    expect(three.css).toEqual({ margin: '1px 2px 3px' });
    expect(calc.css).toMatchObject({ 'padding-top': 'calc(1px + 2px)' });
  });

  it('reads visibility back into the field, both the condition and the starting state', () => {
    const { spec } = specFromSpace(authorSpace(rich));

    expect(spec.pages[0].body[3].visible).toBe(false);
    expect(spec.pages[0].body[4].visible).toBe('!posts.loading');
  });

  it('refuses a document that names no space unless told which one it is', () => {
    const documents = authorSpace(rich);
    documents.schema.definition = { name: '', permanentUrl: '' };

    expect(() => specFromSpace(documents)).toThrow(/names no space/);
    expect(specFromSpace(documents, { name: 'Rich', permanentUrl: 'rich' }).spec.permanentUrl).toBe('rich');
  });
});

/**
 * A document of the kind the builder used to write, with each thing it no longer writes planted once.
 */
const legacy = (): SpaceDocuments => {
  const documents = authorSpace({
    name: 'Legacy',
    permanentUrl: 'legacy',
    classes: { box: { color: 'black' } },
    pages: [
      {
        id: 'home',
        name: 'Home',
        slug: '',
        body: [
          { type: 'container', id: 'nav' },
          { type: 'container', id: 'panel', class: 'box' },
          { type: 'container', id: 'aside', class: 'box' },
          { type: 'text', id: 'label', attributes: { content: 'x' }, bind: { content: 'state.label' } },
          { type: 'link', id: 'out', attributes: { href: 'https://plitzi.com', target: 'blank', mode: 'external' } },
          { type: 'list', id: 'rows' },
          {
            type: 'button',
            id: 'btn',
            attributes: { content: 'Go' },
            flows: [
              [
                { type: 'trigger', action: 'onClick' },
                { type: 'globalCallback', action: 'setState', on: 'state' }
              ]
            ]
          }
        ]
      }
    ]
  });
  const { flat } = documents.schema;
  const platform = documents.style.platform.desktop;

  // A full URL in page mode, which rendered as a path inside the space.
  flat.out.attributes.mode = 'page';
  // A navbar and its items: types the builder no longer ships.
  flat.nav.definition.type = 'navbar';
  flat.nav.attributes = { subtype: 'ul', direction: 'left' };
  flat.nav.definition.items = ['item'];
  flat.item = {
    id: 'item',
    attributes: {},
    definition: { type: 'navbarItem', label: 'Item', rootId: 'home', parentId: 'nav', styleSelectors: { base: '' } }
  };
  // A hover stored as a class of its own, and a rule the style editor cannot hold.
  const hover: StyleItem = {
    name: 'box:hover',
    type: 'state' as StyleItem['type'],
    attributes: { base: { default: { color: 'red' } } },
    cache: ''
  };
  platform['box:hover'] = hover;
  // Outside the vocabulary on purpose, which the style type rightly refuses to spell.
  const unwritable: Record<string, string> = { '-webkit-appearance': 'none' };
  Object.assign(platform.box.attributes.base.default ?? {}, unwritable);
  // A selector nothing defines — which holds no rules, so it is read as none — and fields nothing reads.
  flat.label.definition.styleSelectors.base = 'gone-1234';
  Object.assign(flat.label.definition, { symbolId: 'x', category: 'basic' });
  // A binding to nothing, next to one with the wrong prefix.
  flat.label.definition.bindings = {
    attributes: [
      { id: 'a-1', source: 'apiContainer_nobody.data', to: 'content', transformers: [] },
      { id: 'a-2', source: 'list_btn.title', to: 'title', transformers: [] }
    ]
  };
  // A global callback on the wrong module, and a trigger that runs nothing.
  const steps = flat.btn.definition.interactions ?? {};
  const callback = Object.values(steps).find(step => step.type === 'globalCallback');
  if (callback) {
    callback.elementId = 'btn';
  }

  steps['trigger-9'] = {
    id: 'trigger-9',
    title: 'New Trigger',
    type: 'trigger',
    action: '',
    params: {},
    preview: {},
    elementId: '',
    beforeNode: '',
    afterNode: '',
    flowId: 'trigger-9',
    enabled: false
  };
  // A value the component spells differently today, a list with its items "unset" as null, and a dead setting.
  flat.out.attributes.target = '_blank';
  flat.rows.attributes.items = null;
  Object.assign(documents.schema.settings, { head: '<link rel="preconnect" href="https://fonts.gstatic.com" />' });
  // An element no page contains.
  flat.stray = {
    id: 'stray',
    attributes: {},
    definition: { type: 'text', label: 'Text', rootId: 'home', parentId: 'nowhere', styleSelectors: { base: '' } }
  };

  return documents;
};

describe('specFromSpace / a condition among other bindings', () => {
  /**
   * A visibility binding that is not the last one stays in \`bind\`.
   *
   * \`visible\` is authored as the element's LAST binding, so reading a condition out of the middle of the list into
   * the field moved it to the end on the way back, and the document came back different from the one exported.
   */
  it('keeps its place', () => {
    const { first, second } = roundTrip({
      name: 'Cond',
      permanentUrl: 'cond',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            text('', {
              id: 'caret',
              visible: false,
              bind: [
                { to: 'visibility', source: 'state.open', category: 'initialState' },
                { to: 'content', source: 'state.label' }
              ]
            })
          ]
        }
      ]
    });

    expect(second.schema.flat.caret).toEqual(first.schema.flat.caret);
  });
});

describe('specFromSpace / what it repairs', () => {
  const { spec, corrections } = specFromSpace(legacy());
  const codes = corrections.map(correction => correction.code);

  it('reports every repair it made', () => {
    expect(new Set(codes)).toEqual(
      new Set([
        'legacy-element-type',
        'folded-state-selector',
        'unwritable-css',
        'dropped-field',
        'broken-binding',
        'broken-flow',
        'fixed-global-callback',
        'unreachable-element',
        'fixed-attribute',
        'dropped-setting'
      ])
    );
  });

  it('turns a navbar into a list laid out in a row, and its items into list items', () => {
    const nav = spec.pages[0].body[0];

    expect(nav.type).toBe('list');
    expect(nav.attributes).toEqual({ subType: 'ul' });
    expect(nav.children?.[0].type).toBe('listItem');
  });

  it('folds a hover stored as a class of its own into the class, and keeps the unwritable rule under the same selector', () => {
    expect(spec.classes?.box).toEqual({ css: { color: 'black' }, states: { hover: { color: 'red' } } });
    expect(spec.customCss).toContain('.box{-webkit-appearance:none;}');
  });

  it('drops a binding to nothing and a flow that runs nothing, and points the callback at its module', () => {
    const [, , , label, , , go] = spec.pages[0].body;

    expect(label.bind).toBeUndefined();
    expect(go.flows).toHaveLength(1);
    expect(go.flows?.[0][1]).toMatchObject({ action: 'setState', on: 'state' });
  });

  it('writes a link target the way the component spells it, and leaves a null attribute and a dead setting out', () => {
    const [, , , , out, rows] = spec.pages[0].body;

    expect(out.attributes).toMatchObject({ target: 'blank', mode: 'external', href: 'https://plitzi.com' });
    expect(rows.attributes).not.toHaveProperty('items');
    expect(Object.keys(spec.settings ?? {})).not.toContain('head');
  });

  it('authors what it read into a space the validator accepts', () => {
    expect(authorSpace(spec).warnings.filter(warning => warning.code !== 'tablet-rule-skips-mobile')).toEqual([]);
  });
});

describe('specToSource', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const scratch = mkdtempSync(join(tmpdir(), 'spec-source-'));

  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  const load = async (files: Record<string, string>, name: string): Promise<SpaceSpec> => {
    const root = join(scratch, name);
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), source);
    }

    const module = (await import(join(root, 'index.ts'))) as Record<string, SpaceSpec>;

    return module[name];
  };

  const packageName = join(here, '..', 'index.ts');

  it('writes code that authors the same space, in one file', async () => {
    const documents = authorSpace(rich);
    const { spec } = specFromSpace(documents);
    const files = specToSource(spec, { exportName: 'rich', packageName });

    expect(Object.keys(files)).toEqual(['index.ts']);
    expect(files['index.ts']).toContain("const card = styles('card'");
    expect(files['index.ts']).toContain("heading('Hello', { variant: 'title', bind: { content: 'posts.title' } })");

    expect(compareSpaces(documents, authorSpace(await load(files, 'rich')))).toEqual([]);
  });

  it('writes code that authors the same space, split per page and layout', async () => {
    const documents = authorSpace(rich);
    const { spec } = specFromSpace(documents);
    const files = specToSource(spec, { exportName: 'richSplit', packageName, split: true });

    expect(Object.keys(files).sort()).toEqual([
      'index.ts',
      'layouts/shell.ts',
      'pages/guide.ts',
      'pages/home.ts',
      'styles.ts'
    ]);
    expect(files['pages/home.ts']).toContain("import { card } from '../styles';");
    expect(files['pages/home.ts']).toContain('export const homePage: PageSpec');

    expect(compareSpaces(documents, authorSpace(await load(files, 'richSplit')))).toEqual([]);
  });

  it('names a page whose id already says page without saying it twice', () => {
    const spec: SpaceSpec = {
      name: 'Named',
      permanentUrl: 'named',
      pages: [{ id: 'analytics-page', name: 'Analytics', slug: '', body: [] }]
    };
    const files = specToSource(specFromSpace(authorSpace(spec)).spec, { exportName: 'named', split: true });

    expect(files['pages/analytics-page.ts']).toContain('export const analyticsPage: PageSpec');
  });

  it('leaves out what a factory puts back — the type defaults and the default label', () => {
    const files = specToSource(specFromSpace(authorSpace(blankSpaceSpec)).spec, { exportName: 'blank' });

    expect(files['index.ts']).not.toContain('meta:');
    expect(files['index.ts']).not.toContain("subType: 'div'");
  });

  it('names elements it does not ship through element()', () => {
    const spec: SpaceSpec = {
      name: 'Plugin',
      permanentUrl: 'plugin',
      pages: [{ id: 'home', name: 'Home', slug: '', body: [{ type: 'typed', attributes: { strings: ['a'] } }] }]
    };
    const files = specToSource(specFromSpace(authorSpace(spec)).spec, { exportName: 'plugin' });

    expect(files['index.ts']).toContain("element('typed', { strings: ['a'] })");
  });
  it('writes an element that wears several classes as the list of their declarations', async () => {
    const base = styles('panel', { padding: '12px' });
    const modifier = styles('panel-wide', { width: '100%' });
    const spec: SpaceSpec = {
      name: 'Stacked',
      permanentUrl: 'stacked',
      pages: [{ id: 'home', name: 'Home', slug: '', body: [container({ id: 'box', class: [base, modifier] })] }]
    };
    const documents = authorSpace(spec);
    const read = specFromSpace(documents).spec;
    const files = specToSource(read, { exportName: 'stacked', packageName });

    expect(files['index.ts']).toContain('class: [panel, panelWide]');
    expect(compareSpaces(documents, authorSpace(await load(files, 'stacked')))).toEqual([]);
  });
  it('keeps which of two stacked classes wins, whatever order the tree names them in', async () => {
    // The fill is listed first on the element but declared last, so the stylesheet lets it win.
    const spec: SpaceSpec = {
      name: 'Ordered',
      permanentUrl: 'ordered',
      classes: { danger: { color: 'red' }, fill: { color: 'blue' } },
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          body: [container({ id: 'bar', class: ['fill', 'danger'] }), container({ id: 'solo', class: 'fill' })]
        }
      ]
    };
    const documents = authorSpace(spec);
    const read = specFromSpace(documents).spec;

    for (const split of [false, true]) {
      const exportName = split ? 'orderedSplit' : 'ordered';
      const files = specToSource(read, { exportName, packageName, split });

      expect(compareSpaces(documents, authorSpace(await load(files, exportName)))).toEqual([]);
    }
  });
  it('lists the stacked classes in the space by their variable, imported from the shared styles when split', () => {
    const spec: SpaceSpec = {
      name: 'Listed',
      permanentUrl: 'listed',
      classes: { danger: { color: 'red' }, fill: { color: 'blue' } },
      pages: [{ id: 'home', name: 'Home', slug: '', body: [container({ id: 'bar', class: ['fill', 'danger'] })] }]
    };
    const read = specFromSpace(authorSpace(spec)).spec;
    const single = specToSource(read, { exportName: 'listed', packageName });
    const split = specToSource(read, { exportName: 'listedSplit', packageName, split: true });

    expect(single['index.ts']).toMatch(/classes: \{ danger: danger, fill: fill \}/);
    expect(split['index.ts']).toContain("import { danger, fill } from './styles';");
    expect(split['pages/home.ts']).toContain('class: [fill, danger]');
  });
});

describe('specFromSpace / customCss', () => {
  it('folds a rule a class can hold into the class, and leaves everything else as written', () => {
    const documents = authorSpace({
      name: 'Folded',
      permanentUrl: 'folded',
      classes: { card: { padding: '8px' }, other: { color: 'red' } },
      customCss:
        '/* the hover */\n.card:hover, .other:focus-visible { color: blue; }\n\n.card { padding: 4px; font-variant-numeric: tabular-nums; }\n\n.card .icon { transform: rotate(1deg); }\n\n@media (prefers-reduced-motion: reduce) { .card { transition: none; } }\n',
      pages: [
        { id: 'home', name: 'Home', slug: '', body: [container({ class: 'card' }), container({ class: 'other' })] }
      ]
    });
    const { spec, corrections } = specFromSpace(documents);

    expect(corrections.filter(correction => correction.code === 'folded-custom-css')).toHaveLength(2);
    expect(spec.classes?.card).toMatchObject({
      css: { padding: '4px', 'font-variant-numeric': 'tabular-nums' },
      states: { hover: { color: 'blue' } }
    });
    expect(spec.classes?.other).toMatchObject({ states: { 'focus-visible': { color: 'blue' } } });
    expect(spec.customCss).toBe(
      '.card .icon { transform: rotate(1deg); }\n\n@media (prefers-reduced-motion: reduce) { .card { transition: none; } }\n'
    );
  });
});

describe('several classes on one selector', () => {
  const panel = styles('panel', { padding: '12px' });
  const wide = styles('panel-wide', { width: '100%' });
  const spec: SpaceSpec = {
    name: 'Stacked',
    permanentUrl: 'stacked',
    pages: [
      {
        id: 'home',
        name: 'Home',
        slug: '',
        body: [container({ id: 'box', class: [panel, wide] }), container({ id: 'plain', class: panel })]
      }
    ]
  };

  it('writes them into the one selector, in the order they were listed', () => {
    const { schema } = authorSpace(spec);

    expect(schema.flat.box.definition.styleSelectors.base).toBe('panel panel-wide');
  });

  it('reads them back as a list of classes, never as rules of the element', () => {
    const { spec: read, corrections } = specFromSpace(authorSpace(spec));
    const box = read.pages[0].body[0];

    expect(box.class).toEqual(['panel', 'panel-wide']);
    expect(read.classes).toMatchObject({ panel: { padding: '12px' }, 'panel-wide': { width: '100%' } });
    expect(corrections.filter(correction => correction.code === 'dropped-selector')).toEqual([]);
  });

  it('says so when one of them is not declared, and keeps the rest', () => {
    const documents = authorSpace(spec);
    documents.schema.flat.box.definition.styleSelectors.base = 'panel panel-gone';
    const { spec: read, corrections } = specFromSpace(documents);

    expect(read.pages[0].body[0].class).toBe('panel');
    expect(corrections).toContainEqual(expect.objectContaining({ code: 'dropped-selector', at: 'panel-gone' }));
  });

  it('counts a class lost from the list as a difference', () => {
    const documents = authorSpace(spec);
    const stripped = authorSpace(spec);
    stripped.schema.flat.box.definition.styleSelectors.base = 'panel';

    expect(compareSpaces(documents, stripped)).toContainEqual(
      expect.objectContaining({ at: expect.stringContaining('box') as string })
    );
  });
});

describe('the order of stacked classes', () => {
  const danger = styles('danger', { color: 'red' });
  const fill = styles('fill', { color: 'blue' });
  const body = [container({ id: 'bar', class: [fill, danger] })];

  it('follows `classes` first, so a declaration listed there takes its place in the stylesheet', () => {
    const { style } = authorSpace({
      name: 'Listed',
      permanentUrl: 'listed',
      classes: { danger, fill },
      pages: [{ id: 'home', name: 'Home', slug: '', body }]
    });

    expect(Object.keys(style.platform.desktop).filter(name => name === 'danger' || name === 'fill')).toEqual([
      'danger',
      'fill'
    ]);
  });

  it('refuses a declaration listed under a name that is not its own', () => {
    expect(() =>
      authorSpace({
        name: 'Wrong',
        permanentUrl: 'wrong',
        classes: { other: fill },
        pages: [{ id: 'home', name: 'Home', slug: '', body }]
      })
    ).toThrow(/lists the declaration "fill" under the name "other"/);
  });

  it('is a difference when it changes', () => {
    const page = { id: 'home', name: 'Home', slug: '', body };
    const before = authorSpace({ name: 'Order', permanentUrl: 'order', classes: { danger, fill }, pages: [page] });
    const after = authorSpace({ name: 'Order', permanentUrl: 'order', classes: { fill, danger }, pages: [page] });

    expect(compareSpaces(before, after)).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('stylesheet order of base') as string })
    );
  });
});

describe('specFromSpace / what the builder writes that authoring would not', () => {
  const panel = styles('panel', { padding: '12px' });
  const wide = styles('wide', { width: '100%' });
  const page = (body: ElementSpec[], extra: Partial<PageSpec> = {}): SpaceSpec => ({
    name: 'Builder',
    permanentUrl: 'builder',
    pages: [{ id: 'home', name: 'Home', slug: '', body, ...extra }]
  });
  const emptyClass = (name: string): StyleItem => ({
    name,
    type: 'class',
    attributes: { base: { default: {} } },
    cache: ''
  });
  const roundTrips = (documents: SpaceDocuments): void => {
    expect(compareSpaces(documents, authorSpace(specFromSpace(documents).spec))).toEqual([]);
  };

  it('keeps a class worn alone once as a class when it is stacked somewhere else too', () => {
    // Counted as the whole selector, "panel" alone looked used once and was written into the element as css — and
    // the stacked element lost it.
    const documents = authorSpace(
      page([container({ id: 'stacked', class: [panel, wide] }), container({ id: 'alone', class: panel })])
    );
    const { spec } = specFromSpace(documents);

    expect(spec.pages[0].body[1].class).toBe('panel');
    expect(spec.pages[0].body[1].css).toBeUndefined();
    expect(spec.classes).toHaveProperty('panel');
    roundTrips(documents);
  });

  it('leaves out a stacked selector whose classes are all gone, saying so for each', () => {
    const documents = authorSpace(page([container({ id: 'box', class: panel })]));
    documents.schema.flat.box.definition.styleSelectors.base = 'gone-a gone-b';
    const { spec, corrections } = specFromSpace(documents);

    expect(spec.pages[0].body[0].class).toBeUndefined();
    expect(corrections.filter(correction => correction.code === 'dropped-selector').map(({ at }) => at)).toEqual([
      'gone-a',
      'gone-b'
    ]);
  });

  it('reads several classes on a slot back as a list', () => {
    const documents = authorSpace(page([{ type: 'formControl', id: 'field', slots: { input: [panel, wide] } }]));
    const { spec } = specFromSpace(documents);

    expect(spec.pages[0].body[0].slots).toEqual({ input: ['panel', 'wide'] });
    roundTrips(documents);
  });

  it('reads several classes on a page back as a list', () => {
    const documents = authorSpace(page([], { class: [panel, wide] }));

    expect(specFromSpace(documents).spec.pages[0].class).toEqual(['panel', 'wide']);
    roundTrips(documents);
  });

  it('keeps a stacked class that holds no rules at all', () => {
    // The builder stores an empty block for a class it created; authoring writes none, and neither is a difference.
    const documents = authorSpace(page([container({ id: 'box', class: panel })]));
    documents.style.platform.desktop.marker = emptyClass('marker');
    documents.schema.flat.box.definition.styleSelectors.base = 'panel marker';
    const { spec } = specFromSpace(documents);

    expect(spec.pages[0].body[0].class).toEqual(['panel', 'marker']);
    expect(spec.classes?.marker).toEqual({});
    roundTrips(documents);
  });

  it('reads a shorthand stored after its longhands as the one that renders', () => {
    const documents = authorSpace(page([container({ id: 'box', css: { color: 'red' } })]));
    const selector = documents.schema.flat.box.definition.styleSelectors.base;
    documents.style.platform.desktop[selector].attributes.base.default = {
      'overflow-x': 'hidden',
      'overflow-y': 'hidden',
      overflow: 'scroll'
    };
    const authored = authorSpace(specFromSpace(documents).spec);
    const readBack = authored.schema.flat.box.definition.styleSelectors.base;

    expect(authored.style.platform.desktop[readBack].attributes.base.default).toEqual({
      'overflow-x': 'scroll',
      'overflow-y': 'scroll'
    });
    expect(compareSpaces(documents, authored)).toEqual([]);
  });
});

describe('compareSpaces / stacked classes', () => {
  const panel = styles('panel', { padding: '12px' });
  const wide = styles('wide', { width: '100%' });
  const spec: SpaceSpec = {
    name: 'Compared',
    permanentUrl: 'compared',
    pages: [{ id: 'home', name: 'Home', slug: '', body: [container({ id: 'box', class: [panel, wide] })] }]
  };

  it('compares each class of a list by name, so one renamed is a difference', () => {
    const renamed = authorSpace(spec);
    renamed.style.platform.desktop.broad = { ...renamed.style.platform.desktop.wide, name: 'broad' };
    renamed.schema.flat.box.definition.styleSelectors.base = 'panel broad';

    expect(compareSpaces(authorSpace(spec), renamed)).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('rules of base') as string })
    );
  });

  it('does not count a class that has no rules at a breakpoint in the order', () => {
    const withEmpty = authorSpace(spec);
    withEmpty.style.platform.desktop = {
      marker: { name: 'marker', type: 'class', attributes: { base: { default: {} } }, cache: '' },
      ...withEmpty.style.platform.desktop
    };

    expect(compareSpaces(authorSpace(spec), withEmpty)).toEqual([]);
  });
});
