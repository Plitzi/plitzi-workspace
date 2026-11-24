import { describe, expect, it } from 'vitest';

import { readsTheClock } from './clock';

import type { Element } from '../types';

const element = (type: string, attributes: Record<string, unknown> = {}, definition = {}): Element => ({
  id: type,
  attributes,
  definition: { rootId: type, label: type, type, styleSelectors: { base: '' }, ...definition }
});

describe('a space that reads the clock', () => {
  it('has a time window or a countdown, on its pages or in its components', () => {
    expect(readsTheClock({ flat: { c: element('countdown') } })).toBe(true);
    expect(
      readsTheClock({ flat: {}, components: { c: { id: 'c', rootId: 'w', flat: { w: element('timeWindow') } } } })
    ).toBe(true);
  });

  it('or a template that reads the page’s clock — by name, by `ago`, in a binding or a computed value', () => {
    expect(readsTheClock({ flat: { t: element('text', { content: "{{ time.now|date('H:i') }}" }) } })).toBe(true);
    expect(readsTheClock({ flat: { t: element('text', { content: '{{ post.at|ago }}' }) } })).toBe(true);
    expect(readsTheClock({ flat: { t: element('text', {}, { bindings: [{ source: 'time.today' }] }) } })).toBe(true);
    expect(readsTheClock({ flat: {}, settings: { computed: { open: '{{ time.now > 0 }}' } } })).toBe(true);
  });

  it('and not one whose words only say the time', () => {
    expect(readsTheClock({ flat: { t: element('text', { content: 'Opening time. {{ venue.name }}' }) } })).toBe(false);
  });
});
