import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import * as authoring from '../index';
import { compareSpaces } from './compareSpaces';
import { specFromSpace } from './specFromSpace';
import { specToSource } from './specToSource';

import type { ElementSpec, PageSpec, SpaceDocuments, SpaceSpec } from '../schema';

/**
 * JSON → authoring → JSON, on a space big enough to hold every shape at once.
 *
 * `compareSpaces` answers whether two documents RENDER the same, and forgives what a visitor cannot see — a selector's
 * name, an unreferenced id. This is the stricter question an export has to answer for a space that was authored in
 * the first place: read back and written again, is it the SAME document? Every selector keeps its name, every id and
 * every rule its place, and nothing needs correcting. Anything less is an export that quietly rewrites the space the
 * builder, a stylesheet outside it and the next export all know by the old names.
 */

const { styles } = authoring;

const card = styles('rt-card', { padding: '16px', 'border-radius': '12px', 'background-color': 'var(--card)' });
const muted = styles('rt-muted', { color: 'var(--muted)', 'font-size': '13px' });

/** A name the way the builder mints one — a type and a random suffix, nothing authoring would derive. */
const builderName = (type: string, seed: number): string => `${type}-${(seed * 2654435761).toString(36).slice(-4)}`;

/** One section of every kind, numbered so no two share an id, a selector or a rule. */
const section = (page: number, index: number): ElementSpec => {
  const n = `${page}-${index}`;
  const tint = `${(page * 37 + index * 11) % 360}deg`;

  return authoring.container({
    id: `section-${n}`,
    selector: builderName('container', page * 100 + index),
    css: {
      desktop: { display: 'flex', 'flex-direction': 'column', gap: `${index + 4}px`, filter: `hue-rotate(${tint})` },
      mobile: { gap: '4px' }
    },
    states: { hover: { opacity: '0.9' } },
    children: [
      authoring.heading(`Section ${n}`, { id: `title-${n}`, subType: 'h2', css: { 'font-size': `${18 + index}px` } }),
      authoring.text({ id: `lead-${n}`, content: 'Lead', class: muted, bind: { content: `state.lead${n}` } }),
      // Longhands in an order the shorthand would not write them in: read back, they must stay exactly as they were.
      authoring.paragraph({
        content: `Paragraph ${n}`,
        css: {
          'line-height': '1.6',
          'padding-left': '8px',
          'padding-right': '8px',
          'padding-top': `${index}px`,
          'padding-bottom': `${index}px`
        }
      }),
      authoring.container({
        class: card,
        visible: `state.open${n}`,
        children: [
          authoring.image({ src: `https://cdn.example.com/${n}.png`, alt: `Image ${n}` }),
          authoring.link({ href: 'home', mode: 'page', children: [authoring.text({ content: 'Home' })] }),
          authoring.fontAwesome({ icon: 'fa-solid fa-star', css: { color: 'var(--accent)' } })
        ]
      }),
      // An initialState binding before an attribute one: authoring numbers them by their place in the whole list.
      authoring.text({
        id: `status-${n}`,
        content: 'Status',
        bind: [
          { category: 'initialState', to: 'styleSelectors.base', source: `state.status${n}` },
          { to: 'data-status', source: `state.status${n}` }
        ]
      }),
      authoring.list({
        id: `list-${n}`,
        css: { display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)' },
        children: [authoring.listItem({ children: [authoring.text({ content: `Row ${n}` })] })]
      }),
      authoring.form({
        id: `form-${n}`,
        managedByInteractions: true,
        flows: [
          [
            authoring.named(`sent${index}`, authoring.onSubmit()),
            authoring.setState({ key: `email${n}`, type: 'text', value: `{{sent${index}.values.email}}` })
          ]
        ],
        children: [
          authoring.formControl({ id: `email-${n}`, name: 'email', label: 'Email', subType: 'email', required: true }),
          authoring.button({ content: 'Send', subType: 'submit', css: { 'background-color': 'var(--accent)' } })
        ]
      }),
      authoring.dropdown({
        id: `menu-${n}`,
        children: [
          authoring.text({ content: 'Menu' }),
          authoring.dropdownPopup({ children: [authoring.button({ content: 'Item' })] })
        ]
      }),
      authoring.button({
        id: `toggle-${n}`,
        content: 'Toggle',
        flows: [
          [authoring.onClick(), authoring.toggleState({ key: `open${n}` })],
          [authoring.on('onMouseEnter'), authoring.openModal(`modal-${n}`)]
        ]
      }),
      authoring.modalContainer({
        id: `modal-${n}`,
        visible: false,
        children: [authoring.text({ content: 'Inside' }), authoring.button({ content: 'Close' })]
      })
    ]
  });
};

const page = (index: number): PageSpec => ({
  id: index === 0 ? 'home' : `page-${index}`,
  name: `Page ${index}`,
  slug: index === 0 ? '' : `page-${index}`,
  isDefault: index === 0,
  ...(index % 4 === 3 ? { folder: 'guides' } : {}),
  layout: { id: 'shell', slot: 'shell-body' },
  selector: builderName('page', index),
  css: { display: 'flex', 'flex-direction': 'column', 'padding-left': `${index}px` },
  flows: [[authoring.onPageLoad(), authoring.setState({ key: 'visited', type: 'boolean', value: true })]],
  body: Array.from({ length: 12 }, (_, section_) => section(index, section_))
});

const largeSpace: SpaceSpec = {
  name: 'Round trip',
  permanentUrl: 'round-trip',
  // Written the way a person writes a stylesheet, blank lines and all: nothing here folds, so it comes back verbatim.
  customCss: '\nhtml { scroll-behavior: smooth; }\n\n@keyframes rt-rise { from { opacity: 0; } to { opacity: 1; } }',
  classes: {
    'rt-shared': { 'max-width': '1200px', 'margin-left': 'auto', 'margin-right': 'auto' },
    // Declared with no rules yet — a hook for a stylesheet. Its name has to survive on the elements that wear it.
    'rt-hook': {}
  },
  pageFolders: [{ id: 'guides' }],
  layouts: [
    {
      id: 'shell',
      css: { display: 'flex', 'min-height': '100vh' },
      body: [
        authoring.container({
          id: 'shell-nav',
          class: ['rt-shared', 'rt-hook'],
          // `text-900` has the shape of a derived id and is not the one this position would get: it is a name.
          children: [authoring.themeToggle({ id: 'shell-theme' }), authoring.text({ id: 'text-900', content: 'Brand' })]
        }),
        authoring.container({ id: 'shell-body', css: { 'flex-grow': '1' } })
      ]
    }
  ],
  pages: Array.from({ length: 16 }, (_, index) => page(index))
};

/** Every element's own selector, by id — the names the builder and anything outside the document know it by. */
const selectorsOf = ({ schema }: SpaceDocuments): Record<string, unknown> =>
  Object.fromEntries(Object.values(schema.flat).map(element => [element.id, element.definition.styleSelectors]));

describe('JSON → authoring → JSON', () => {
  const original = authoring.authorSpace(largeSpace);

  it('is a space big enough to mean something', () => {
    expect(Object.keys(original.schema.flat).length).toBeGreaterThan(2500);
  });

  it('reads an authored space back without a correction', { timeout: 60_000 }, () => {
    const { corrections } = specFromSpace(original);

    expect(corrections).toEqual([]);
  });

  it('writes the same document again: every id, selector name and rule where it was', { timeout: 60_000 }, () => {
    const again = authoring.authorSpace(specFromSpace(original).spec);

    expect(compareSpaces(original, again)).toEqual([]);
    expect(selectorsOf(again)).toEqual(selectorsOf(original));
    expect(again.style.platform).toEqual(original.style.platform);
    expect(again.schema).toEqual(original.schema);
  });

  describe('through the code the Export writes', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const scratch = mkdtempSync(join(tmpdir(), 'round-trip-'));

    afterAll(() => rmSync(scratch, { recursive: true, force: true }));

    it('writes code that authors the same document, split per page and layout', { timeout: 120_000 }, async () => {
      const files = specToSource(specFromSpace(original).spec, {
        exportName: 'roundTrip',
        packageName: join(here, '..', 'index.ts'),
        split: true
      });
      for (const [path, source] of Object.entries(files)) {
        mkdirSync(dirname(join(scratch, path)), { recursive: true });
        writeFileSync(join(scratch, path), source);
      }

      const module = (await import(join(scratch, 'index.ts'))) as { roundTrip: SpaceSpec };
      const again = authoring.authorSpace(module.roundTrip);

      expect(compareSpaces(original, again)).toEqual([]);
      expect(selectorsOf(again)).toEqual(selectorsOf(original));
      expect(again.schema).toEqual(original.schema);
      expect(again.style.platform).toEqual(original.style.platform);
    });
  });
});
