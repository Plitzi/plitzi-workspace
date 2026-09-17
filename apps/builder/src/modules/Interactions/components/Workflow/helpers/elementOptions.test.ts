import { describe, expect, it } from 'vitest';

import { pickableOptions, pickedElements, toIdList, toWorkflowElements } from './elementOptions';

import type { Element } from '@plitzi/sdk-shared';

const element = (id: string, type: string, label: string) => ({ id, definition: { type, label } }) as Element;

const elements = toWorkflowElements({
  orders: element('orders', 'apiContainer', 'Orders'),
  title: element('title', 'heading', 'Heading'),
  members: element('members', 'apiContainer', 'Members')
});

describe('element picker helpers', () => {
  it('lists the space’s elements by id', () => {
    expect(elements.map(item => item.id)).toEqual(['members', 'orders', 'title']);
  });

  it('offers the elements of the asked type that are not picked yet', () => {
    expect(pickableOptions(elements, 'apiContainer', ['orders'])).toEqual([
      { value: 'members', label: 'members · Members' }
    ]);
    expect(pickableOptions(elements, undefined, [])).toHaveLength(3);
  });

  it('keeps a picked id no element answers to, flagged', () => {
    expect(pickedElements(['orders', 'gone'], elements)).toEqual([
      { id: 'orders', label: 'orders · Orders', missing: false },
      { id: 'gone', label: 'gone', missing: true }
    ]);
  });

  it('reads anything but a list of ids as nothing picked', () => {
    expect(toIdList(['a', 1])).toEqual(['a']);
    expect(toIdList('a, b')).toEqual([]);
  });
});
