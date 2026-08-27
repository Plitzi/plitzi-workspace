import { describe, expect, expectTypeOf, it } from 'vitest';

import { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';

import { defineElement, element } from './element';
import * as factoriesModule from './elements';
import { container, heading, image, link, text } from './elements';
import { elementsFromManifest } from './plugins';

import type { AuthoringProps } from './element';
import type { PluginManifest } from '@plitzi/sdk-shared';
import type { AttributesOf } from '@plitzi/sdk-shared/authoring/declare';

/**
 * The catalogue is the map: an element that declares itself is authorable, and these are the guarantees that
 * cannot be read off a single call site.
 */

describe('element factories', () => {
  it('carries the element defaults, with the author on top', () => {
    expect(heading({ content: 'Fieldnotes' })).toEqual({
      type: 'heading',
      attributes: { content: 'Fieldnotes', subType: 'h1' },
      meta: { label: 'Heading' }
    });
  });

  it('takes the content directly, which is most of a page', () => {
    expect(text('Wildlife, close up').attributes).toEqual({ content: 'Wildlife, close up' });
  });

  it('takes children directly, which is most of a layout', () => {
    const box = container([text('a'), text('b')]);

    expect(box.children).toHaveLength(2);
    expect(box.type).toBe('container');
  });

  it('keeps attributes and authoring fields apart without either being nested', () => {
    const spec = image({ src: '/fox.jpg', alt: 'A fox', class: 'cover', idRef: 'hero-image' });

    expect(spec.attributes).toMatchObject({ src: '/fox.jpg', alt: 'A fox' });
    expect(spec.class).toBe('cover');
    expect(spec.idRef).toBe('hero-image');
    expect(spec.attributes).not.toHaveProperty('class');
  });

  it('gives an attribute called label to the attribute, and names the tree through meta', () => {
    // Both a link and a form control carry a real `label`. Reserving the name for the builder's tree would shadow
    // the one an author obviously means.
    const spec = link({ href: '/', label: 'Home', meta: { label: 'Brand link' } });

    expect(spec.attributes?.label).toBe('Home');
    expect(spec.meta?.label).toBe('Brand link');
  });

  it('binds in the short form and in the full one', () => {
    expect(text({ bind: { content: 'apiContainer_posts.title' } }).bind).toEqual({
      content: 'apiContainer_posts.title'
    });
  });

  it('offers a factory for every element that is not the machinery′s own', () => {
    const authorable = Object.entries(elementDeclarations).filter(
      ([, declaration]) =>
        (declaration as { content?: { market?: { category?: string } } }).content?.market?.category !== 'internal'
    );

    const missing = authorable
      .map(([name]) => `${name[0].toLowerCase()}${name.slice(1)}`)
      .filter(name => !(name in factoriesModule));

    expect(missing).toEqual([]);
  });
});

describe('element', () => {
  it('merges the defaults of a built-in named by its document type', () => {
    expect(element('heading', { content: 'Hi' }).attributes).toEqual({ content: 'Hi', subType: 'h1' });
  });

  it('authors a type this SDK does not ship, with no defaults to merge', () => {
    const spec = element<{ status?: string }>('speciesStatus', { status: 'vulnerable', class: 'panel' });

    expect(spec).toEqual({
      type: 'speciesStatus',
      class: 'panel',
      attributes: { status: 'vulnerable' },
      meta: { label: 'speciesStatus' }
    });
  });
});

describe('defineElement', () => {
  it('makes a plugin type as authorable as a built-in one', () => {
    const speciesStatus = defineElement<{ name?: string; status?: string }>({
      type: 'speciesStatus',
      content: { attributes: { status: 'unknown' }, definition: { label: 'Species Status' } }
    });

    expect(speciesStatus({ name: 'Iberian lynx' })).toEqual({
      type: 'speciesStatus',
      attributes: { status: 'unknown', name: 'Iberian lynx' },
      meta: { label: 'Species Status' }
    });
  });

  it('reads a plugin manifest, whose schema is the same shape as a declaration', () => {
    const manifest = {
      pluginSchema: {
        chart: { attributes: { kind: 'bar' }, definition: { label: 'Chart' } }
      }
    } as unknown as PluginManifest;

    const { chart } = elementsFromManifest<{ chart: { kind?: string } }>(manifest);

    expect(chart({ kind: 'line' }).attributes).toEqual({ kind: 'line' });
  });
});

describe('the types', () => {
  it('types an attribute from the element′s own component', () => {
    expectTypeOf<AttributesOf<typeof elementDeclarations.Heading>>().toEqualTypeOf<{
      content?: string;
      subType?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    }>();
  });

  it('leaves no attribute name colliding with an authoring field', () => {
    // If this stops compiling, an element has just declared an attribute called `class`, `css`, `children`,
    // `bind`, `flows`, `slots`, `variant`, `runtime`, `idRef` or `meta` — and a flat prop can no longer say which
    // of the two it meant. `keyof` a union answers with the keys they SHARE, so the union of every key has to be
    // built by hand; the `label` assertion below is what proves this one is looking at anything at all.
    type EveryAttributeKey = {
      [Name in keyof typeof elementDeclarations]: keyof AttributesOf<(typeof elementDeclarations)[Name]>;
    }[keyof typeof elementDeclarations];

    expectTypeOf<Extract<EveryAttributeKey, 'label'>>().toEqualTypeOf<'label'>();
    expectTypeOf<Extract<EveryAttributeKey, keyof AuthoringProps>>().toEqualTypeOf<never>();
  });
});
