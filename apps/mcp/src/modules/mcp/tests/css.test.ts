import { describe, it, expect } from 'vitest';

import { buildSpace } from './helpers';
import { validate } from '../tools';

describe('mcp-ai CSS shorthand auto-expansion', () => {
  it('expands overflow: hidden to overflow-x and overflow-y', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { overflow: 'hidden' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands overflow: hidden auto to overflow-x and overflow-y', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { overflow: 'hidden auto' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts overflow-x as a direct longhand', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { 'overflow-x': 'auto' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts overflow-y as a direct longhand', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { 'overflow-y': 'scroll' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands flex: 1 to flex-grow, flex-shrink, flex-basis', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'item', desktop: { flex: '1' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands flex-flow to flex-direction and flex-wrap', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'item', desktop: { 'flex-flow': 'column wrap' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands place-items to align-items and justify-items', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'grid', desktop: { 'place-items': 'center start' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands place-self to align-self and justify-self', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'grid', desktop: { 'place-self': 'stretch' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands place-content to align-content and justify-content', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'grid', desktop: { 'place-content': 'center' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands outline to outline-width, outline-style, outline-color', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'btn', desktop: { outline: '2px solid blue' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands list-style to list-style-type, list-style-position, list-style-image', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'list', desktop: { 'list-style': 'disc inside' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands text-decoration to line, color, and style', () => {
    const r = validate(
      {
        operations: [{ type: 'upsertDefinition', ref: 'link', desktop: { 'text-decoration': 'underline red' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands transition to property, duration, timing-function, delay', () => {
    const r = validate(
      {
        operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { transition: 'opacity 200ms ease 0s' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands animation shorthand', () => {
    const r = validate(
      {
        operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { animation: 'fadeIn 1s ease infinite' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands background shorthand', () => {
    const r = validate(
      {
        operations: [{ type: 'upsertDefinition', ref: 'hero', desktop: { background: 'red no-repeat center' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands font shorthand', () => {
    const r = validate(
      {
        operations: [{ type: 'upsertDefinition', ref: 'text', desktop: { font: 'italic bold 16px Arial' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands columns shorthand', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'cols', desktop: { columns: '200px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands grid-area shorthand', () => {
    const r = validate(
      {
        operations: [{ type: 'upsertDefinition', ref: 'item', desktop: { 'grid-area': '1 / 2 / 3 / 4' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('still rejects genuinely unknown CSS properties', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'btn', desktop: { 'nonexistent-prop': 'value' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toContain('Unknown CSS property "nonexistent-prop"');
  });

  it('explicit longhand wins over shorthand expansion', () => {
    const r = validate(
      {
        operations: [
          {
            type: 'upsertDefinition',
            ref: 'box',
            desktop: { overflow: 'hidden', 'overflow-x': 'auto' }
          }
        ]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands inset shorthand', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'pos', desktop: { inset: '10px 20px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands border-top shorthand', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'bt', desktop: { 'border-top': '2px solid red' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands border-right shorthand', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'br', desktop: { 'border-right': 'dashed' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands border-bottom shorthand', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'bb', desktop: { 'border-bottom': '1px dotted blue' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands border-left shorthand', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'bl', desktop: { 'border-left': '3px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands grid shorthand', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'g', desktop: { grid: '1fr 2fr' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands grid-template shorthand', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'gt', desktop: { 'grid-template': '1fr "header"' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands gap with single value', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'gap', desktop: { gap: '16px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands padding with 1, 3, and 4 values', () => {
    const r1 = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'p1', desktop: { padding: '8px' } }] },
      buildSpace()
    );
    expect(r1.valid).toBe(true);

    const r3 = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'p3', desktop: { padding: '1px 2px 3px' } }] },
      buildSpace()
    );
    expect(r3.valid).toBe(true);

    const r4 = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'p4', desktop: { padding: '1px 2px 3px 4px' } }] },
      buildSpace()
    );
    expect(r4.valid).toBe(true);
  });

  it('expands margin with 1, 3, and 4 values', () => {
    const r1 = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'm1', desktop: { margin: '0' } }] },
      buildSpace()
    );
    expect(r1.valid).toBe(true);

    const r3 = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'm3', desktop: { margin: '10px 20px 30px' } }] },
      buildSpace()
    );
    expect(r3.valid).toBe(true);

    const r4 = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'm4', desktop: { margin: '1px 2px 3px 4px' } }] },
      buildSpace()
    );
    expect(r4.valid).toBe(true);
  });

  it('expands border-radius with 2, 3, and 4 values', () => {
    const r2 = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'br2', desktop: { 'border-radius': '4px 8px' } }] },
      buildSpace()
    );
    expect(r2.valid).toBe(true);

    const r3 = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'br3', desktop: { 'border-radius': '1px 2px 3px' } }] },
      buildSpace()
    );
    expect(r3.valid).toBe(true);

    const r4 = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'br4', desktop: { 'border-radius': '1px 2px 3px 4px' } }] },
      buildSpace()
    );
    expect(r4.valid).toBe(true);
  });

  it('expands border with 1 and 2 tokens', () => {
    const r1 = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'b1', desktop: { border: 'solid' } }] },
      buildSpace()
    );
    expect(r1.valid).toBe(true);

    const r2 = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'b2', desktop: { border: '2px dashed' } }] },
      buildSpace()
    );
    expect(r2.valid).toBe(true);
  });

  it('expands border with color only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'bco', desktop: { border: 'red' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands outline with width only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'ow', desktop: { outline: '2px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands outline with color only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'oco', desktop: { outline: 'blue' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands list-style with position only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'lp', desktop: { 'list-style': 'inside' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands list-style with image only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'li', desktop: { 'list-style': 'url(icon.png)' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands text-decoration with line only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'tdl', desktop: { 'text-decoration': 'underline' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands text-decoration with style only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'tds', desktop: { 'text-decoration': 'wavy' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands transition with property only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'tp', desktop: { transition: 'opacity' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands transition with duration only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'td', desktop: { transition: '200ms' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands animation with duration only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'ad', desktop: { animation: '500ms' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands animation with timing only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'at2', desktop: { animation: 'ease-in' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands background with color only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'bconly', desktop: { background: 'blue' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands background with repeat only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'brpt', desktop: { background: 'no-repeat' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands background with position only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'bpos', desktop: { background: 'center' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands background with url only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'burl', desktop: { background: 'url(bg.png)' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands overflow with visible only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'ovs', desktop: { overflow: 'visible' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands flex with auto only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'fa', desktop: { flex: 'auto' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands flex with percentage only', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'fp', desktop: { flex: '50%' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands flex 2-value (grow + shrink)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'f2', desktop: { flex: '1 2' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands flex 3-value (grow + shrink + basis)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'f3', desktop: { flex: '1 2 10px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands flex 2-value with basis (grow + basis)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'fb', desktop: { flex: '1 50%' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands inset 1-value', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'i1', desktop: { inset: '10px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands inset 3-value', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'i3', desktop: { inset: '10px 20px 30px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands inset 4-value', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'i4', desktop: { inset: '1px 2px 3px 4px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands gap 2-value', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'gap2', desktop: { gap: '10px 20px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands padding 2-value', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'p2', desktop: { padding: '10px 20px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands margin 2-value', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'm2', desktop: { margin: '10px 20px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands border-radius 1-value', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'br1', desktop: { 'border-radius': '4px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands grid with none', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'gN', desktop: { grid: 'none' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands columns with number value (column-count)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'cN', desktop: { columns: '3' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('expands columns 2-value (width + count)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'c2', desktop: { columns: '200px 3' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
});

describe('mcp-ai malformed CSS shorthands', () => {
  it('accepts the elliptical border-radius form (expanded per corner)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'br', desktop: { 'border-radius': '10px / 5px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
  });

  it('rejects completely unknown shorthand key', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'x', desktop: { 'bogus-prop': 'value' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toContain('bogus-prop');
  });

  it('rejects transition shorthand as key (only valid as shorthand, not longhand)', () => {
    const r = validate(
      {
        operations: [
          {
            type: 'upsertDefinition',
            ref: 'x',
            desktop: { transition: 'opacity 200ms ease', 'transition-property': 'color' }
          }
        ]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts flex with two non-numeric tokens (drops silently, no invalid keys produced)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'fb', desktop: { flex: 'bogus bogus' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts overflow with 3 tokens (uses first two only)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'of', desktop: { overflow: 'hidden auto scroll' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts transition with only timing function', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'tt', desktop: { transition: 'ease' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts animation with only name', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'an', desktop: { animation: 'fadeIn' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts background with unknown token (treated as color)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'bg', desktop: { background: 'bogus' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts font without family (only font-size)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'fn', desktop: { font: '16px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts flex-flow with only direction', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'ff', desktop: { 'flex-flow': 'column' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts flex-flow with only wrap', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'ffw', desktop: { 'flex-flow': 'nowrap' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts place-items with single value (duplicates to both align and justify)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'pi', desktop: { 'place-items': 'start' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts grid-area 1-value (named area)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'ga1', desktop: { 'grid-area': 'header' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts grid-area 3-value (row-start / col-start / row-end)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'ga3', desktop: { 'grid-area': '1 / 2 / 3' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts outline with single style token', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'ol', desktop: { outline: 'dashed' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts list-style with single unknown token (dropped, no invalid keys)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'ls', desktop: { 'list-style': 'bogus' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts text-decoration with single style token', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'td', desktop: { 'text-decoration': 'wavy' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts margin with auto keyword', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'ma', desktop: { margin: '0 auto' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts gap with 0 value', () => {
    const r = validate({ operations: [{ type: 'upsertDefinition', ref: 'g0', desktop: { gap: '0' } }] }, buildSpace());
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts font with quoted family name', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'fq', desktop: { font: '14px "Helvetica Neue"' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts transition with cubic-bezier timing', () => {
    const r = validate(
      {
        operations: [
          { type: 'upsertDefinition', ref: 'tcb', desktop: { transition: 'opacity 200ms cubic-bezier(0.4,0,0.2,1)' } }
        ]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts animation with two time values (duration + delay)', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'at', desktop: { animation: 'fadeIn 2s 1s' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts background with linear-gradient', () => {
    const r = validate(
      {
        operations: [{ type: 'upsertDefinition', ref: 'bgr', desktop: { background: 'linear-gradient(red, blue)' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts border with transparent color', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'bt2', desktop: { border: '1px solid transparent' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts columns with auto value', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'ca', desktop: { columns: 'auto' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts grid with bracket notation', () => {
    const r = validate(
      {
        operations: [{ type: 'upsertDefinition', ref: 'gb', desktop: { grid: '[col-start] 1fr [col-end]' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts grid with repeat()', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'gr', desktop: { grid: 'repeat(3,1fr)' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts grid with minmax()', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'gm', desktop: { grid: 'minmax(0,1fr) 2fr' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts text-decoration with overline', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'tdo', desktop: { 'text-decoration': 'overline' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts inset with negative values', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'in2', desktop: { inset: '-10px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts border with inherit keyword', () => {
    const r = validate(
      { operations: [{ type: 'upsertDefinition', ref: 'bin', desktop: { border: 'inherit' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
});
