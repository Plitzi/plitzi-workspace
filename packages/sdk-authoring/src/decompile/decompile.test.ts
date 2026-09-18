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

import type { SpaceDocuments, SpaceSpec } from '../schema';
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
  customCss: '.card:focus-within { outline: 1px solid; }',
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
          { type: 'link', id: 'out', attributes: { href: 'https://plitzi.com', target: 'blank' } },
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

    expect(out.attributes).toMatchObject({ target: 'blank' });
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
    expect(files['index.ts']).toContain('const card = styles(\'card\'');
    expect(files['index.ts']).toContain('heading(\'Hello\', { variant: \'title\', bind: { content: \'posts.title\' } })');

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
    expect(files['pages/home.ts']).toContain('import { card } from \'../styles\';');

    expect(compareSpaces(documents, authorSpace(await load(files, 'richSplit')))).toEqual([]);
  });

  it('leaves out what a factory puts back — the type defaults and the default label', () => {
    const files = specToSource(specFromSpace(authorSpace(blankSpaceSpec)).spec, { exportName: 'blank' });

    expect(files['index.ts']).not.toContain('meta:');
    expect(files['index.ts']).not.toContain('subType: \'div\'');
  });

  it('names elements it does not ship through element()', () => {
    const spec: SpaceSpec = {
      name: 'Plugin',
      permanentUrl: 'plugin',
      pages: [{ id: 'home', name: 'Home', slug: '', body: [{ type: 'typed', attributes: { strings: ['a'] } }] }]
    };
    const files = specToSource(specFromSpace(authorSpace(spec)).spec, { exportName: 'plugin' });

    expect(files['index.ts']).toContain('element(\'typed\', { strings: [\'a\'] })');
  });
});
