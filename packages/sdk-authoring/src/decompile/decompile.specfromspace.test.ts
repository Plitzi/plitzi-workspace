import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { repointIds } from '@plitzi/sdk-schema';

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
  settings: { keepState: true, stateStorage: 'localStorage', transientState: ['tourStep'] },
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
      documentScroll: 'locked',
      layout: { id: 'shell', slot: 'slot' },
      css: { 'min-height': '100vh' },
      body: [
        // What reads the provider sits inside it: its source reaches its descendants only.
        apiContainer({
          id: 'posts',
          endpoint: '/posts',
          children: [
            heading('Hello', { subType: 'h1', bind: { content: 'posts.title' }, variant: 'title' }),
            text('maybe', {
              visible: '!posts.loading',
              bind: [{ to: 'className', source: 'state.theme', transformers: [{ action: 'not', params: {} }] }]
            })
          ]
        }),
        container({ class: card, children: [text('a')] }),
        container({ class: card, visible: false }),
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
    { id: 'guide', name: 'Guide', slug: 'guide', folder: 'docs', body: [] }
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

  it('keeps the permissions a page is for, so an export does not publish it open', () => {
    const space: SpaceSpec = {
      name: 'Kept',
      permanentUrl: 'kept',
      pages: [
        { id: 'home', name: 'Home', slug: '', body: [heading('Welcome', { id: 'welcome' })] },
        {
          id: 'staff',
          name: 'Staff',
          slug: 'staff',
          access: { permissions: ['bookingsRead'] },
          body: [heading('Bookings', { id: 'bookings' })]
        }
      ]
    };
    const first = authorSpace(space);
    const { spec, corrections } = specFromSpace(first);

    expect(corrections).toEqual([]);
    expect(spec.pages.find(page => page.id === 'staff')?.access).toEqual({ permissions: ['bookingsRead'] });
    expect(compareSpaces(first, authorSpace(spec))).toEqual([]);
  });

  it('round-trips the blank space every account starts with', () => {
    const { first, second } = roundTrip(blankSpaceSpec);

    expect(compareSpaces(first, second)).toEqual([]);
  });

  it('round-trips pseudo-elements, conditions, the parent and the keyframes a class plays', () => {
    const space: SpaceSpec = {
      name: 'Motion',
      permanentUrl: 'motion',
      keyframes: { 'caret-blink': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } } },
      classes: {
        caret: {
          css: { 'animation-name': 'caret-blink', 'animation-duration': '1s' },
          pseudos: {
            after: { css: { content: '"|"' }, states: { hover: { color: 'red' } } },
            selection: { 'background-color': 'black' }
          },
          conditions: {
            'motion-reduce': { 'animation-name': 'none' },
            'container card (max-width: 30rem)': {
              css: { 'font-size': '14px' },
              pseudos: { after: { content: 'none' } }
            }
          },
          ancestors: { '>': { states: { expanded: { color: 'blue' } } } }
        }
      },
      pages: [{ id: 'home', name: 'Home', slug: '', body: [text('Typing', { id: 'typing', class: 'caret' })] }]
    };
    const { first, second } = roundTrip(space);
    const { spec } = specFromSpace(first);

    expect(compareSpaces(first, second)).toEqual([]);
    // Read back from the CSS they were written as: every value is its text.
    expect(spec.keyframes).toEqual({ 'caret-blink': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } } });
    expect(first.schema.settings.customCss).toMatch(/^@keyframes caret-blink \{/);
    expect(first.style.platform.desktop.caret.cache).toContain('&::after{content:"|";}');
    expect(first.style.platform.desktop.caret.cache).toContain('@media (prefers-reduced-motion: reduce)');
    expect(first.style.platform.desktop.caret.cache).toContain('@container card (max-width: 30rem)');
  });

  it('keeps a name something refers to, and leaves out one nothing does', () => {
    const { spec } = specFromSpace(authorSpace(rich));
    const body = spec.pages[0].body;

    expect(body[0].id).toBe('posts');
    expect(body[0].children?.[0].id).toBeUndefined();
    expect(body[0].children?.[0].bind).toEqual({ content: 'posts.title' });
  });

  it('keeps every id when asked, for a space people keep working in', () => {
    const { spec } = specFromSpace(authorSpace(rich), { keepIds: true });

    expect(spec.pages[0].body[0].children?.[0].id).toBe('heading-1');
  });

  it('writes a selector one element uses into that element, and keeps a shared one as a class', () => {
    const { spec } = specFromSpace(authorSpace(rich));

    expect(spec.pages[0].css).toEqual({ 'min-height': '100vh' });
    expect(spec.pages[0].body[1].class).toBe('card');
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

    expect(spec.pages[0].body[2].visible).toBe(false);
    expect(spec.pages[0].body[0].children?.[1].visible).toBe('!posts.loading');
  });

  it('refuses a document that names no space unless told which one it is', () => {
    const documents = authorSpace(rich);
    documents.schema.definition = { name: '', permanentUrl: '' };

    expect(() => specFromSpace(documents)).toThrow(/names no space/);
    expect(specFromSpace(documents, { name: 'Rich', permanentUrl: 'rich' }).spec.permanentUrl).toBe('rich');
  });
});
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

  // Older documents carry `keepState` on a page, which the runtime never read — it keeps state per space. Reading one
  // back drops it and says so, rather than handing the author a field that promises something nothing does.
  it('drops a page keepState, which nothing reads', () => {
    const documents = authorSpace({
      name: 'Old',
      permanentUrl: 'old',
      pages: [{ id: 'home', name: 'Home', slug: '', body: [] }]
    });
    documents.schema.flat.home.attributes = {
      ...documents.schema.flat.home.attributes,
      keepState: true,
      stateStorage: 'localStorage'
    };
    const { spec: read, corrections: repairs } = specFromSpace(documents);

    expect(read.pages[0]).not.toHaveProperty('keepState');
    expect(repairs.map(repair => repair.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('page attribute "keepState"')])
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
describe('specFromSpace / element keys from before the id was the name', () => {
  /**
   * `documents` as a builder kept them before an element's id was its name: `flat` keyed by ObjectIds and the name
   * beside each in `idRef`. Every other one starts with a letter, which is a valid id and still not the name.
   */
  const keyedByObjectId = (documents: SpaceDocuments): SpaceDocuments => {
    const schema = structuredClone(documents.schema);
    const names = Object.keys(schema.flat);
    const keys = Object.fromEntries(
      names.map((name, index) => [
        name,
        `${index % 2 ? 'a' : '6'}55221a12565b83ac5060e${String(index).padStart(2, '0')}`
      ])
    );
    repointIds(schema.flat, keys, schema.pages);
    names.forEach(name => Object.assign(schema.flat[keys[name]], { idRef: name }));

    return { ...documents, schema };
  };

  it('reads them back under their names, with everything that pointed at them', () => {
    const current = authorSpace(rich);
    const { spec, corrections } = specFromSpace(keyedByObjectId(current));

    expect(spec).toEqual(specFromSpace(current).spec);
    expect(corrections).toHaveLength(Object.keys(current.schema.flat).length);
    expect(new Set(corrections.map(correction => correction.code))).toEqual(new Set(['legacy-element-id']));
  });

  it('names one that carries no name after its type', () => {
    const documents = authorSpace({
      name: 'Old',
      permanentUrl: 'old',
      pages: [{ id: 'home', name: 'Home', slug: '', body: [heading({ id: 'intro', content: 'Hi' })] }]
    });
    repointIds(documents.schema.flat, { intro: '6552289be0053d3e506eafe5' }, documents.schema.pages);
    const { spec, corrections } = specFromSpace(documents, { keepIds: true });

    expect(spec.pages[0].body[0].id).toBe('heading-1');
    expect(corrections).toEqual([expect.objectContaining({ code: 'legacy-element-id', at: 'heading-1' })]);
  });

  it('refuses a space with no pages, which there is no code to write for', () => {
    const documents = authorSpace(rich);
    documents.schema.pages = [];

    expect(() => specFromSpace(documents)).toThrow(/has no pages/);
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
      // The page authoring gave the space for an unknown address, the project's own from here on.
      'pages/plitzi-not-found.ts',
      'styles.ts'
    ]);
    expect(files['pages/home.ts']).toContain("import { card } from '../styles';");
    expect(files['pages/home.ts']).toContain('export const homePage: PageSpec');

    expect(compareSpaces(documents, authorSpace(await load(files, 'richSplit')))).toEqual([]);
  });

  /** `plitzi create --from`: Node runs the project by stripping types, and imports a file only by its full name. */
  it('names the files a split export imports by their extension, for a project Node runs as it is', () => {
    const { spec } = specFromSpace(authorSpace(rich));
    const files = specToSource(spec, { exportName: 'richSplit', packageName, split: true, importExtension: '.ts' });

    expect(files['pages/home.ts']).toContain("import { card } from '../styles.ts';");
    expect(files['index.ts']).toContain("from './pages/home.ts';");
    expect(Object.values(files).join('\n')).not.toMatch(/from '\.{1,2}\/[^']*(?<!\.ts)'/);
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

    expect(corrections.filter(correction => correction.code === 'folded-custom-css')).toHaveLength(3);
    expect(spec.classes?.card).toMatchObject({
      css: { padding: '4px', 'font-variant-numeric': 'tabular-nums' },
      states: { hover: { color: 'blue' } },
      conditions: { 'motion-reduce': { 'transition-property': 'none' } }
    });
    expect(spec.classes?.other).toMatchObject({ states: { 'focus-visible': { color: 'blue' } } });
    expect(spec.customCss).toBe('.card .icon { transform: rotate(1deg); }\n');
  });

  it('folds a pseudo-element, in a state and under a condition, and leaves one that would draw nothing', () => {
    const documents = authorSpace({
      name: 'Folded',
      permanentUrl: 'folded',
      classes: { more: { color: 'gray' } },
      customCss: [
        '.more::after { content: "→"; margin-left: 6px; }',
        '.more:hover::after { margin-left: 10px; }',
        '@container (max-width: 30rem) { .more::after { content: none; } }',
        '.more::before { color: red; }',
        '.more::selection { padding: 4px; }'
      ].join('\n\n'),
      pages: [{ id: 'home', name: 'Home', slug: '', body: [container({ class: 'more' })] }]
    });
    const { spec } = specFromSpace(documents);

    expect(spec.classes?.more).toMatchObject({
      pseudos: {
        after: { css: { content: '"→"', 'margin-left': '6px' }, states: { hover: { 'margin-left': '10px' } } }
      },
      conditions: { 'container (max-width: 30rem)': { pseudos: { after: { content: 'none' } } } }
    });
    expect(spec.customCss).toBe('.more::before { color: red; }\n\n.more::selection { padding: 4px; }\n');
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
          {
            type: 'link',
            id: 'out',
            attributes: { href: 'https://plitzi.com', target: 'blank', mode: 'external', label: 'Plitzi' }
          },
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
