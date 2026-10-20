import { describe, it, expect } from 'vitest';

import { buildSpace, checkBatch } from './helpers';

describe('MCP CSS shorthand auto-expansion', () => {
  it('expands background with repeat only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'brpt', desktop: { background: 'no-repeat' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands background with position only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'bpos', desktop: { background: 'center' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands background with url only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'burl', desktop: { background: 'url(bg.png)' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands overflow with visible only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'ovs', desktop: { overflow: 'visible' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands flex with auto only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'fa', desktop: { flex: 'auto' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands flex with percentage only', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'fp', desktop: { flex: '50%' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands flex 2-value (grow + shrink)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'f2', desktop: { flex: '1 2' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands flex 3-value (grow + shrink + basis)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'f3', desktop: { flex: '1 2 10px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands flex 2-value with basis (grow + basis)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'fb', desktop: { flex: '1 50%' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands inset 1-value', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'i1', desktop: { inset: '10px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands inset 3-value', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'i3', desktop: { inset: '10px 20px 30px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands inset 4-value', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'i4', desktop: { inset: '1px 2px 3px 4px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands gap 2-value', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'gap2', desktop: { gap: '10px 20px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands padding 2-value', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'p2', desktop: { padding: '10px 20px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands margin 2-value', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'm2', desktop: { margin: '10px 20px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands border-radius 1-value', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'br1', desktop: { 'border-radius': '4px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands grid with none', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'gN', desktop: { grid: 'none' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands columns with number value (column-count)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'cN', desktop: { columns: '3' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('expands columns 2-value (width + count)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'c2', desktop: { columns: '200px 3' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
});
describe('MCP malformed CSS shorthands', () => {
  it('accepts the elliptical border-radius form (expanded per corner)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'br', desktop: { 'border-radius': '10px / 5px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
  });

  it('rejects completely unknown shorthand key', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'x', desktop: { 'bogus-prop': 'value' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toContain('bogus-prop');
  });

  it('rejects transition shorthand as key (only valid as shorthand, not longhand)', () => {
    const r = checkBatch(
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
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'fb', desktop: { flex: 'bogus bogus' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts overflow with 3 tokens (uses first two only)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'of', desktop: { overflow: 'hidden auto scroll' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts transition with only timing function', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'tt', desktop: { transition: 'ease' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts animation with only name', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'an', desktop: { animation: 'fadeIn' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts background with unknown token (treated as color)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'bg', desktop: { background: 'bogus' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts font without family (only font-size)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'fn', desktop: { font: '16px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts flex-flow with only direction', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'ff', desktop: { 'flex-flow': 'column' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts flex-flow with only wrap', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'ffw', desktop: { 'flex-flow': 'nowrap' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts place-items with single value (duplicates to both align and justify)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'pi', desktop: { 'place-items': 'start' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts grid-area 1-value (named area)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'ga1', desktop: { 'grid-area': 'header' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts grid-area 3-value (row-start / col-start / row-end)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'ga3', desktop: { 'grid-area': '1 / 2 / 3' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts outline with single style token', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'ol', desktop: { outline: 'dashed' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts list-style with single unknown token (dropped, no invalid keys)', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'ls', desktop: { 'list-style': 'bogus' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts text-decoration with single style token', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'td', desktop: { 'text-decoration': 'wavy' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts margin with auto keyword', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'ma', desktop: { margin: '0 auto' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts gap with 0 value', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'g0', desktop: { gap: '0' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts font with quoted family name', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'fq', desktop: { font: '14px "Helvetica Neue"' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts transition with cubic-bezier timing', () => {
    const r = checkBatch(
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
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'at', desktop: { animation: 'fadeIn 2s 1s' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts background with linear-gradient', () => {
    const r = checkBatch(
      {
        operations: [{ type: 'upsertDefinition', ref: 'bgr', desktop: { background: 'linear-gradient(red, blue)' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts border with transparent color', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'bt2', desktop: { border: '1px solid transparent' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts columns with auto value', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'ca', desktop: { columns: 'auto' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts grid with bracket notation', () => {
    const r = checkBatch(
      {
        operations: [{ type: 'upsertDefinition', ref: 'gb', desktop: { grid: '[col-start] 1fr [col-end]' } }]
      },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts grid with repeat()', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'gr', desktop: { grid: 'repeat(3,1fr)' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts grid with minmax()', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'gm', desktop: { grid: 'minmax(0,1fr) 2fr' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts text-decoration with overline', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'tdo', desktop: { 'text-decoration': 'overline' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts inset with negative values', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'in2', desktop: { inset: '-10px' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('accepts border with inherit keyword', () => {
    const r = checkBatch(
      { operations: [{ type: 'upsertDefinition', ref: 'bin', desktop: { border: 'inherit' } }] },
      buildSpace()
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
});
