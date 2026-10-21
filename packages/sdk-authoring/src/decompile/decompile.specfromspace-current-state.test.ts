import { describe, expect, it } from 'vitest';

import { CURRENT_SELECTOR } from '@plitzi/sdk-shared/style';

import { container, link } from '../elements';
import { authorSpace } from '../index';
import { styles } from '../style';
import { compareSpaces } from './compareSpaces';
import { specFromSpace } from './specFromSpace';

import type { ElementSpec, PageSpec, SpaceDocuments, SpaceSpec } from '../schema';
import type { StyleItem } from '@plitzi/sdk-shared';

describe('specFromSpace / the current state', () => {
  it('folds the attribute a link to this page carries into the class, as its current state', () => {
    const documents = authorSpace({
      name: 'Current',
      permanentUrl: 'current',
      classes: { navLink: { color: 'gray' } },
      customCss: ".navLink[aria-current='page'] { color: red; }\n",
      pages: [{ id: 'home', name: 'Home', slug: '', body: [link({ href: '/', class: 'navLink', children: [] })] }]
    });
    const { spec } = specFromSpace(documents);

    expect(spec.classes?.navLink).toMatchObject({ states: { current: { color: 'red' } } });
    expect(spec.customCss ?? '').toBe('');
  });

  it('folds a pressed toggle and a selected tab into the class, as its current state too', () => {
    const documents = authorSpace({
      name: 'Current',
      permanentUrl: 'current',
      classes: { option: { color: 'gray' }, tab: { color: 'gray' } },
      customCss: '.option[aria-pressed=\'true\'] { color: red; }\n.tab[aria-selected="true"] { color: blue; }\n',
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          body: [link({ href: '/', class: 'option', children: [] }), link({ href: '/', class: 'tab', children: [] })]
        }
      ]
    });
    const { spec } = specFromSpace(documents);

    expect(spec.classes?.option).toMatchObject({ states: { current: { color: 'red' } } });
    expect(spec.classes?.tab).toMatchObject({ states: { current: { color: 'blue' } } });
    expect(spec.customCss ?? '').toBe('');
  });

  it('folds where an element sits and an open control into the class, as the states that say them', () => {
    const documents = authorSpace({
      name: 'Structural',
      permanentUrl: 'structural',
      classes: { row: { color: 'gray' }, toggle: { color: 'gray' } },
      customCss: [
        '.row:first-child { margin-top: 0; }',
        '.row:last-child { margin-bottom: 0; }',
        '.row:nth-child(even) { background-color: whitesmoke; }',
        ".toggle[aria-expanded='true'] { color: red; }",
        ''
      ].join('\n'),
      pages: [
        {
          id: 'home',
          name: 'Home',
          slug: '',
          body: [container({ class: 'row' }), link({ href: '/', class: 'toggle', children: [] })]
        }
      ]
    });
    const { spec } = specFromSpace(documents);

    expect(spec.classes?.row).toMatchObject({
      states: {
        first: { 'margin-top': '0' },
        last: { 'margin-bottom': '0' },
        even: { 'background-color': 'whitesmoke' }
      }
    });
    expect(spec.classes?.toggle).toMatchObject({ states: { expanded: { color: 'red' } } });
    expect(spec.customCss ?? '').toBe('');
  });

  it('writes the state as the attributes of the chosen one of a set', () => {
    const { style } = authorSpace({
      name: 'Current',
      permanentUrl: 'current',
      classes: { navLink: { css: { color: 'gray' }, states: { current: { color: 'red' } } } },
      pages: [{ id: 'home', name: 'Home', slug: '', body: [link({ href: '/', class: 'navLink', children: [] })] }]
    });

    expect(style.platform.desktop.navLink.cache).toContain(`&${CURRENT_SELECTOR}{color:red;}`);
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
