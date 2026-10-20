import { describe, it, expect, beforeEach } from 'vitest';

import StyleMap from './StyleMap';
import { createBaseStyle, paramsBase } from './tests/StyleMap';

import type { Style, StyleTarget } from '@plitzi/sdk-shared';

describe('StyleMap / ancestor conditions', () => {
  let style: Pick<Style, 'platform' | 'variables'>;
  const hoverOfCard: StyleTarget & { styleSelector: string } = {
    styleSelector: 'base',
    styleAncestor: 'card',
    styleState: 'hover'
  };

  beforeEach(() => {
    style = createBaseStyle();
    StyleMap.addSelector(style, 'desktop', 'icon', 'class', undefined, { color: 'black' }, paramsBase);
  });

  it('writes a property under the ancestor state, and compiles it', () => {
    expect(StyleMap.updateSelector(style, 'desktop', 'icon', 'color', 'red', hoverOfCard)).toBe(true);
    expect(style.platform.desktop.icon.attributes.base.ancestors).toEqual({
      card: { states: { hover: { color: 'red' } } }
    });
    expect(style.platform.desktop.icon.cache).toContain(':where(.card:hover) &{color:red;}');
  });

  it('writes under an ancestor variant and its states', () => {
    const collapsed = { styleSelector: 'base', styleAncestor: 'sidebar', styleVariant: 'collapsed' };
    StyleMap.updateSelector(style, 'desktop', 'icon', 'display', 'none', collapsed);
    StyleMap.updateSelector(style, 'desktop', 'icon', 'display', 'block', { ...collapsed, styleState: 'hover' });

    expect(style.platform.desktop.icon.attributes.base.ancestors?.sidebar).toEqual({
      variants: { collapsed: { default: { display: 'none' }, states: { hover: { display: 'block' } } } }
    });
  });

  it('creates the class with the rule when the element had none', () => {
    expect(StyleMap.addSelector(style, 'desktop', 'text-1', 'class', 'color', 'red', hoverOfCard)).toBe(true);
    expect(style.platform.desktop['text-1'].attributes.base.ancestors?.card.states?.hover).toEqual({ color: 'red' });
  });

  it('writes rules that hold inside the ancestor at all times, with no state or variant', () => {
    const inside = { styleSelector: 'base', styleAncestor: 'toolbar' };
    expect(StyleMap.updateSelector(style, 'desktop', 'icon', 'font-size', '12px', inside)).toBe(true);
    expect(style.platform.desktop.icon.attributes.base.ancestors?.toolbar).toEqual({
      default: { 'font-size': '12px' }
    });
    expect(style.platform.desktop.icon.cache).toContain(':where(.toolbar) &{font-size:12px;}');

    expect(StyleMap.addSelector(style, 'desktop', 'other', 'class', 'color', 'red', inside)).toBe(true);
    expect(style.platform.desktop.other.attributes.base.ancestors?.toolbar.default).toEqual({ color: 'red' });
  });

  it('removes one state, then the ancestor once nothing is left under it, and keeps the class', () => {
    StyleMap.updateSelector(style, 'desktop', 'icon', 'color', 'red', hoverOfCard);
    StyleMap.updateSelector(style, 'desktop', 'icon', 'color', 'blue', { ...hoverOfCard, styleState: 'active' });
    StyleMap.updateSelector(style, 'desktop', 'icon', undefined, undefined, hoverOfCard);
    expect(style.platform.desktop.icon.attributes.base.ancestors).toEqual({
      card: { states: { active: { color: 'blue' } } }
    });

    StyleMap.updateSelector(style, 'desktop', 'icon', undefined, undefined, { ...hoverOfCard, styleState: 'active' });
    expect(style.platform.desktop.icon.attributes.base).toEqual({ default: { color: 'black' } });
  });

  it('purges every rule under an ancestor at once', () => {
    StyleMap.updateSelector(style, 'desktop', 'icon', 'color', 'red', hoverOfCard);
    StyleMap.updateSelector(style, 'desktop', 'icon', 'color', 'blue', { ...hoverOfCard, styleAncestor: 'row' });
    StyleMap.updateSelector(style, 'desktop', 'icon', undefined, undefined, {
      styleSelector: 'base',
      styleAncestor: 'card'
    });

    expect(Object.keys(style.platform.desktop.icon.attributes.base.ancestors ?? {})).toEqual(['row']);
    expect(style.platform.desktop.icon.cache).not.toContain('.card');
  });

  it('clears the rules inside an ancestor with an empty set, keeping its states', () => {
    const inside = { styleSelector: 'base', styleAncestor: 'card' };
    StyleMap.updateSelector(style, 'desktop', 'icon', 'font-size', '12px', inside);
    StyleMap.updateSelector(style, 'desktop', 'icon', 'color', 'red', hoverOfCard);
    StyleMap.updateSelector(style, 'desktop', 'icon', undefined, {}, inside);

    expect(style.platform.desktop.icon.attributes.base.ancestors).toEqual({
      card: { states: { hover: { color: 'red' } } }
    });
  });

  it('removes one state of an ancestor variant, and the variant once it holds nothing', () => {
    const collapsed = { styleSelector: 'base', styleAncestor: 'sidebar', styleVariant: 'collapsed' };
    StyleMap.updateSelector(style, 'desktop', 'icon', 'display', 'block', { ...collapsed, styleState: 'hover' });
    StyleMap.updateSelector(style, 'desktop', 'icon', 'display', 'block', { ...collapsed, styleState: 'focus' });
    StyleMap.updateSelector(style, 'desktop', 'icon', undefined, undefined, { ...collapsed, styleState: 'hover' });
    expect(style.platform.desktop.icon.attributes.base.ancestors?.sidebar.variants?.collapsed.states).toEqual({
      focus: { display: 'block' }
    });

    StyleMap.updateSelector(style, 'desktop', 'icon', undefined, undefined, { ...collapsed, styleState: 'focus' });
    expect(style.platform.desktop.icon.attributes.base).toEqual({ default: { color: 'black' } });
  });

  it('removes one state of the class own variant and keeps the variant, as a name to pick', () => {
    const primary = { styleSelector: 'base', styleVariant: 'primary' };
    StyleMap.updateSelector(style, 'desktop', 'icon', 'color', 'blue', primary);
    StyleMap.updateSelector(style, 'desktop', 'icon', 'color', 'navy', { ...primary, styleState: 'hover' });
    StyleMap.updateSelector(style, 'desktop', 'icon', undefined, undefined, { ...primary, styleState: 'hover' });

    expect(style.platform.desktop.icon.attributes.base.variants).toEqual({ primary: { default: { color: 'blue' } } });
  });

  it('still drops the last state of the class itself without touching its base', () => {
    const hover = { styleSelector: 'base', styleState: 'hover' as const };
    StyleMap.updateSelector(style, 'desktop', 'icon', 'color', 'red', hover);
    StyleMap.updateSelector(style, 'desktop', 'icon', undefined, undefined, hover);

    expect(style.platform.desktop.icon.attributes.base).toEqual({ default: { color: 'black' } });
  });
});
describe('StyleMap / pseudo-elements, conditions and the parent', () => {
  let style: Pick<Style, 'platform' | 'variables'>;

  beforeEach(() => {
    style = createBaseStyle();
    StyleMap.addSelector(style, 'desktop', 'card', 'class', undefined, { color: 'black' }, paramsBase);
  });

  it('writes a pseudo-element, and its state, and compiles them last in the selector', () => {
    const after = { styleSelector: 'base', stylePseudo: 'after' as const };
    expect(StyleMap.updateSelector(style, 'desktop', 'card', 'content', '"→"', after)).toBe(true);
    expect(
      StyleMap.updateSelector(style, 'desktop', 'card', 'translate', '4px 0', { ...after, styleState: 'hover' })
    ).toBe(true);

    expect(style.platform.desktop.card.attributes.base.pseudos).toEqual({
      after: { default: { content: '"→"' }, states: { hover: { translate: '4px 0' } } }
    });
    expect(style.platform.desktop.card.cache).toContain('&:hover::after{translate:4px 0;}');
  });

  it('writes under a condition whose key is no path segment, and removes it whole', () => {
    const narrow = { styleSelector: 'base', styleCondition: 'container (max-width: 30.5rem)' };
    expect(StyleMap.updateSelector(style, 'desktop', 'card', 'flex-direction', 'column', narrow)).toBe(true);
    expect(style.platform.desktop.card.attributes.base.conditions).toEqual({
      'container (max-width: 30.5rem)': { default: { 'flex-direction': 'column' } }
    });

    expect(StyleMap.updateSelector(style, 'desktop', 'card', undefined, undefined, narrow)).toBe(true);
    expect(style.platform.desktop.card.attributes.base.conditions).toBeUndefined();
  });

  it('drops a condition left with nothing in it when its last state goes', () => {
    const reduced = { styleSelector: 'base', styleCondition: 'motion-reduce', styleState: 'hover' as const };
    StyleMap.updateSelector(style, 'desktop', 'card', 'transform', 'none', reduced);
    StyleMap.updateSelector(style, 'desktop', 'card', undefined, undefined, reduced);

    expect(style.platform.desktop.card.attributes.base).toEqual({ default: { color: 'black' } });
  });

  it('writes the parent’s state under `>`', () => {
    const open = { styleSelector: 'base', styleAncestor: '>', styleState: 'expanded' as const };
    expect(StyleMap.updateSelector(style, 'desktop', 'card', 'rotate', '180deg', open)).toBe(true);
    expect(style.platform.desktop.card.attributes.base.ancestors).toEqual({
      '>': { states: { expanded: { rotate: '180deg' } } }
    });
  });

  it('refuses a target no block has: a condition key that is none, a condition with variants, a pseudo under an ancestor', () => {
    expect(
      StyleMap.updateSelector(style, 'desktop', 'card', 'color', 'red', {
        styleSelector: 'base',
        styleCondition: 'print'
      })
    ).toBe(false);
    expect(
      StyleMap.updateSelector(style, 'desktop', 'card', 'color', 'red', {
        styleSelector: 'base',
        styleCondition: 'motion-safe',
        styleVariant: 'ghost'
      })
    ).toBe(false);
    expect(
      StyleMap.updateSelector(style, 'desktop', 'card', 'color', 'red', {
        styleSelector: 'base',
        styleAncestor: 'list',
        stylePseudo: 'before'
      })
    ).toBe(false);
  });
});
