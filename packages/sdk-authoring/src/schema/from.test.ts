/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
import { describe, expect, it } from 'vitest';

import { authorSpace, button, container, heading, image, list, text } from '../index';

import type { ElementSpec, SpaceSpec } from './types';

const space = (body: ElementSpec[], formats?: Record<string, string>): SpaceSpec => ({
  name: 'From',
  permanentUrl: 'from',
  ...(formats ? { formats } : {}),
  pages: [{ id: 'home', name: 'Home', slug: '', body }]
});

const bindingsOf = (spec: SpaceSpec, id: string) => {
  const { schema } = authorSpace(spec);

  return { attributes: schema.flat[id].attributes, bindings: Object.values(schema.flat[id].definition.bindings ?? {}) };
};

describe('from', () => {
  it('binds the main attribute of the type, and leaves it empty until the data answers', () => {
    const { attributes, bindings } = bindingsOf(space([heading({ id: 'title', from: 'state.title' })]), 'title');

    expect(attributes.content).toBe('');
    expect(bindings.flat().map(binding => [binding.to, binding.source])).toEqual([['content', 'state.title']]);
  });

  it('is the same binding `bind` writes', () => {
    const short = authorSpace(space([image({ id: 'cover', alt: 'Cover', from: 'state.cover' })]));
    const long = authorSpace(space([image({ id: 'cover', alt: 'Cover', src: '', bind: { src: 'state.cover' } })]));

    expect(short.schema.flat.cover).toEqual(long.schema.flat.cover);
  });

  it('shows the data `as` a format of the space, or a template of its own', () => {
    const formats = { price: "{{ source|currency('USD', 'en', { trimZeros: true }) }}" };
    const [named] = bindingsOf(
      space([text({ id: 'price', from: 'state.price', as: 'price' })], formats),
      'price'
    ).bindings.flat();
    const [inline] = bindingsOf(
      space([button({ id: 'count', from: 'state.count', as: '{{ source }} left' })]),
      'count'
    ).bindings.flat();

    expect(named.transformers?.[0]?.params.template).toBe(formats.price);
    expect(inline.transformers?.[0]?.params.template).toBe('{{ source }} left');
  });

  it('hands a list its items as a value', () => {
    const { bindings } = bindingsOf(
      space([list({ id: 'rows', source: 'controlled', from: 'state.rows', as: '{{ source|slice(0, 3) }}' })]),
      'rows'
    );

    expect(bindings.flat()[0].transformers?.[0]?.params.returnMode).toBe('value');
  });

  it('is refused where it has nothing to bind, twice over, or a format nobody declared', () => {
    expect(() => authorSpace(space([container({ id: 'box', from: 'state.x' })]))).toThrow(/\[from-without-attribute\]/);
    expect(() => authorSpace(space([text({ id: 't', from: 'state.x', bind: { content: 'state.y' } })]))).toThrow(
      /\[from-and-bind\]/
    );
    expect(() =>
      authorSpace(space([text({ id: 't', from: 'state.x', as: 'prize' })], { price: '{{ source }}' }))
    ).toThrow(/\[format-unknown\].*did you mean "price"/s);
    expect(() => authorSpace(space([text({ id: 't', as: 'price' })]))).toThrow(/\[as-without-from\]/);
  });
});
