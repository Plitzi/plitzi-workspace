import { describe, it, expect } from 'vitest';

import { buildSpace, checkBatch } from './helpers';

describe('MCP CSS shorthand auto-expansion', () => {
  it('expands overflow: hidden to overflow-x and overflow-y', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { overflow: 'hidden' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands overflow: hidden auto to overflow-x and overflow-y', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { overflow: 'hidden auto' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('accepts overflow-x as a direct longhand', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { 'overflow-x': 'auto' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('accepts overflow-y as a direct longhand', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { 'overflow-y': 'scroll' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands flex: 1 to flex-grow, flex-shrink, flex-basis', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'item', desktop: { flex: '1' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands flex-flow to flex-direction and flex-wrap', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'item', desktop: { 'flex-flow': 'column wrap' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands place-items to align-items and justify-items', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'grid', desktop: { 'place-items': 'center start' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands place-self to align-self and justify-self', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'grid', desktop: { 'place-self': 'stretch' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands place-content to align-content and justify-content', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'grid', desktop: { 'place-content': 'center' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands outline to outline-width, outline-style, outline-color', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'btn', desktop: { outline: '2px solid blue' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands list-style to list-style-type, list-style-position, list-style-image', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'list', desktop: { 'list-style': 'disc inside' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands text-decoration to line, color, and style', () => {
    const r = checkBatch(
      {
        operations: [{ type: 'upsertDefinition', ref: 'link', desktop: { 'text-decoration': 'underline red' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands transition to property, duration, timing-function, delay', () => {
    const r = checkBatch(
      {
        operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { transition: 'opacity 200ms ease 0s' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands animation shorthand', () => {
    const r = checkBatch(
      {
        operations: [{ type: 'upsertDefinition', ref: 'box', desktop: { animation: 'fadeIn 1s ease infinite' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands background shorthand', () => {
    const r = checkBatch(
      {
        operations: [{ type: 'upsertDefinition', ref: 'hero', desktop: { background: 'red no-repeat center' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands font shorthand', () => {
    const r = checkBatch(
      {
        operations: [{ type: 'upsertDefinition', ref: 'text', desktop: { font: 'italic bold 16px Arial' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands columns shorthand', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'cols', desktop: { columns: '200px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands grid-area shorthand', () => {
    const r = checkBatch(
      {
        operations: [{ type: 'upsertDefinition', ref: 'item', desktop: { 'grid-area': '1 / 2 / 3 / 4' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('still rejects genuinely unknown CSS properties', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'btn', desktop: { 'nonexistent-prop': 'value' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toContain('Unknown CSS property "nonexistent-prop"');
  });
  it('explicit longhand wins over shorthand expansion', () => {
    const r = checkBatch(
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
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'pos', desktop: { inset: '10px 20px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands border-top shorthand', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'bt', desktop: { 'border-top': '2px solid red' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands border-right shorthand', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'br', desktop: { 'border-right': 'dashed' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands border-bottom shorthand', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'bb', desktop: { 'border-bottom': '1px dotted blue' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands border-left shorthand', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'bl', desktop: { 'border-left': '3px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands grid shorthand', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'g', desktop: { grid: '1fr 2fr' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands grid-template shorthand', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'gt', desktop: { 'grid-template': '1fr "header"' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands gap with single value', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'gap', desktop: { gap: '16px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands padding with 1, 3, and 4 values', () => {
    const r1 = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'p1', desktop: { padding: '8px' } }] },
      buildSpace()
    );
    expect(r1.valid).toBe(true);

    const r3 = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'p3', desktop: { padding: '1px 2px 3px' } }] },
      buildSpace()
    );
    expect(r3.valid).toBe(true);

    const r4 = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'p4', desktop: { padding: '1px 2px 3px 4px' } }] },
      buildSpace()
    );
    expect(r4.valid).toBe(true);
  });
  it('expands margin with 1, 3, and 4 values', () => {
    const r1 = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'm1', desktop: { margin: '0' } }] },
      buildSpace()
    );
    expect(r1.valid).toBe(true);

    const r3 = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'm3', desktop: { margin: '10px 20px 30px' } }] },
      buildSpace()
    );
    expect(r3.valid).toBe(true);

    const r4 = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'm4', desktop: { margin: '1px 2px 3px 4px' } }] },
      buildSpace()
    );
    expect(r4.valid).toBe(true);
  });
  it('expands border-radius with 2, 3, and 4 values', () => {
    const r2 = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'br2', desktop: { 'border-radius': '4px 8px' } }] },
      buildSpace()
    );
    expect(r2.valid).toBe(true);

    const r3 = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'br3', desktop: { 'border-radius': '1px 2px 3px' } }] },
      buildSpace()
    );
    expect(r3.valid).toBe(true);

    const r4 = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'br4', desktop: { 'border-radius': '1px 2px 3px 4px' } }] },
      buildSpace()
    );
    expect(r4.valid).toBe(true);
  });
  it('expands border with 1 and 2 tokens', () => {
    const r1 = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'b1', desktop: { border: 'solid' } }] },
      buildSpace()
    );
    expect(r1.valid).toBe(true);

    const r2 = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'b2', desktop: { border: '2px dashed' } }] },
      buildSpace()
    );
    expect(r2.valid).toBe(true);
  });
  it('expands border with color only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'bco', desktop: { border: 'red' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands outline with width only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'ow', desktop: { outline: '2px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands outline with color only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'oco', desktop: { outline: 'blue' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands list-style with position only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'lp', desktop: { 'list-style': 'inside' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands list-style with image only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'li', desktop: { 'list-style': 'url(icon.png)' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands text-decoration with line only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'tdl', desktop: { 'text-decoration': 'underline' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands text-decoration with style only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'tds', desktop: { 'text-decoration': 'wavy' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands transition with property only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'tp', desktop: { transition: 'opacity' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands transition with duration only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'td', desktop: { transition: '200ms' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands animation with duration only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'ad', desktop: { animation: '500ms' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands animation with timing only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'at2', desktop: { animation: 'ease-in' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands background with color only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'bconly', desktop: { background: 'blue' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
});
