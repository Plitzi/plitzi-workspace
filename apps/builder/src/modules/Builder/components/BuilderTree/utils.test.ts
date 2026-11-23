import { describe, expect, it } from 'vitest';

import { recursiveMap } from './utils';

import type { ComponentDefinition, Element } from '@plitzi/sdk-shared';

const element = (id: string, type: string, attributes: Record<string, unknown> = {}, items?: string[]): Element => ({
  id,
  attributes,
  definition: { rootId: 'home', label: type, type, styleSelectors: { base: '' }, ...(items ? { items } : {}) }
});

// The tree reads only an element type's icon and label: the rest of a definition is not what is tested.
const icons = {
  variants: { market: { icon: 'fa-solid fa-shuffle' }, definition: { label: 'Variants' } },
  variantItem: { market: { icon: 'fa-solid fa-code-branch' }, definition: { label: 'Variant' } }
} as unknown as Record<string, ComponentDefinition>;

const flat = (attributes: Record<string, unknown>) => ({
  home: element('home', 'page', {}, ['pricing']),
  pricing: element('pricing', 'variants', attributes, ['weekly', 'yearly']),
  weekly: element('weekly', 'variantItem', {}, []),
  yearly: element('yearly', 'variantItem', {}, [])
});

const rows = (attributes: Record<string, unknown>, editing = true) =>
  recursiveMap(flat(attributes), icons, 'home', editing)?.items?.[0].items?.map(({ id, icon, hint }) => ({
    id,
    icon,
    hint
  }));

describe('the layers tree', () => {
  it('lights the icon of the variant the canvas shows, and fades the others', () => {
    expect(rows({ builderVariant: 1 })).toEqual([
      { id: 'weekly', icon: 'fa-solid fa-code-branch opacity-40', hint: 'A' },
      { id: 'yearly', icon: 'fa-solid fa-code-branch text-primary-600! dark:text-primary-300!', hint: 'B · on screen' }
    ]);
  });

  it('says them by place when chosen by rules, and claims none on screen in the preview', () => {
    expect(rows({ chooseBy: 'rules' }, false)).toEqual([
      { id: 'weekly', icon: 'fa-solid fa-code-branch', hint: '1' },
      { id: 'yearly', icon: 'fa-solid fa-code-branch', hint: '2' }
    ]);
  });
});
