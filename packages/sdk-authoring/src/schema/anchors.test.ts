import { describe, expect, it } from 'vitest';

import { compareSpaces } from '../decompile/compareSpaces';
import { specFromSpace } from '../decompile/specFromSpace';
import { apiContainer, authorSpace, container, heading, link, list, text } from '../index';

import type { ComponentSpec, ElementSpec, SpaceSpec } from './types';

const shell: NonNullable<SpaceSpec['layouts']>[number] = {
  id: 'main-layout',
  label: 'Main',
  body: [container({ id: 'top', anchor: 'top' }), container({ id: 'main-slot' })]
};

const space = (home: ElementSpec[], extra: Partial<SpaceSpec> = {}): SpaceSpec => ({
  name: 'Anchors',
  permanentUrl: 'anchors',
  layouts: [shell],
  pages: [
    { id: 'home', name: 'Home', slug: '', layout: { id: 'main-layout', slot: 'main-slot' }, body: home },
    {
      id: 'about',
      name: 'About',
      slug: 'about',
      body: [link({ id: 'back', href: 'home', mode: 'page', hash: 'plans', children: [text('Plans')] })]
    }
  ],
  ...extra
});

const plans = container({ id: 'plans-section', anchor: 'plans', children: [heading('Plans')] });

describe('anchor', () => {
  it('is the element’s id in the DOM, and a link to it lands on it', () => {
    const { schema, warnings } = authorSpace(space([plans]));

    expect(schema.flat['plans-section'].definition.anchor).toBe('plans');
    expect(schema.flat.back.attributes).toMatchObject({ href: 'home', hash: 'plans' });
    expect(warnings.filter(warning => warning.code.startsWith('anchor'))).toEqual([]);
  });

  it('comes back from the document as it was written', () => {
    const authored = authorSpace(space([plans]));
    const { spec, corrections } = specFromSpace(authored);

    expect(corrections).toEqual([]);
    expect(compareSpaces(authored, authorSpace(spec))).toEqual([]);
  });

  it('is refused when it is not a fragment a URL can carry, with the one it meant', () => {
    expect(() => authorSpace(space([container({ id: 'a', anchor: 'Our Plans' })]))).toThrow(
      /anchor "Our Plans"[^]*"our-plans"/
    );
  });

  it('is refused twice on one page, counting the layouts around it', () => {
    expect(() => authorSpace(space([plans, container({ id: 'top-again', anchor: 'top' })]))).toThrow(
      /\[anchor-duplicate\][^]*"top"/
    );
  });

  it('is refused where it would repeat: in a list row, or in a component', () => {
    const row = list({ id: 'rows', source: 'controlled', children: [container({ id: 'row', anchor: 'row' })] });
    expect(() => authorSpace(space([plans, row]))).toThrow(/\[anchor-repeated\][^]*list "rows"/);

    const card: ComponentSpec = { id: 'card', root: container({ id: 'card-root', anchor: 'card' }) };
    expect(() => authorSpace(space([plans], { components: [card] }))).toThrow(
      /\[anchor-repeated\][^]*once per instance/
    );
  });

  it('is refused on an element with no tag of its own', () => {
    expect(() => authorSpace(space([plans, apiContainer({ id: 'data', anchor: 'data', query: '/x.json' })]))).toThrow(
      /\[anchor-no-tag\]/
    );
  });

  it('refuses a link to a section the page does not have, naming the ones it does', () => {
    expect(() => authorSpace(space([container({ id: 'pricing', anchor: 'pricing' })]))).toThrow(
      /\[anchor-missing\][^]*"home#plans"[^]*"pricing"/
    );
  });
});
