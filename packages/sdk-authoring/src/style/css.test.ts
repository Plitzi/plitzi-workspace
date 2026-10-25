import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { styles } from './classes';
import { css, toBlocks, toResponsive } from './css';
import { column, grid, row } from './layout';

import type { StyleSpec } from './types';

describe('css', () => {
  it('expands shorthands the style editor has no control for', () => {
    expect(css({ padding: '96px 24px' })).toEqual({
      'padding-top': '96px',
      'padding-right': '24px',
      'padding-bottom': '96px',
      'padding-left': '24px'
    });
  });

  // A scene in 3D — a disc tilted back, things standing up on it — and a transform built of its parts.
  it('takes the 3D properties and the transform parts, each a property of its own', () => {
    const scene = {
      'transform-style': 'preserve-3d',
      perspective: '1600px',
      'perspective-origin': '50% 30%',
      'backface-visibility': 'hidden',
      translate: '0 24px',
      rotate: '-6deg'
    };

    expect(css(scene)).toEqual(scene);
  });

  it('reads a bare number for `scale` as the factor it is, not a length', () => {
    expect(css({ scale: 0.94 })).toEqual({ scale: 0.94 });
  });

  // What a marketing page masks and highlights with: a dotted map faded at its edges, a heading tinted line by line.
  // Vertical Japanese or Chinese: refused, a column one character wide was the only way to write it.
  it('takes text set in columns, and how each character stands in them', () => {
    expect(css({ 'writing-mode': 'vertical-rl', 'text-orientation': 'upright' })).toEqual({
      'writing-mode': 'vertical-rl',
      'text-orientation': 'upright'
    });
  });

  it('takes masks, the prefixed text clip, box-decoration-break and border-image', () => {
    const effects = {
      'mask-image': 'radial-gradient(black, transparent)',
      '-webkit-mask-image': 'radial-gradient(black, transparent)',
      'mask-size': '8px 8px',
      'mask-position': 'center',
      'mask-repeat': 'repeat',
      'mask-composite': 'intersect',
      '-webkit-background-clip': 'text',
      'box-decoration-break': 'clone',
      '-webkit-box-decoration-break': 'clone',
      'border-image': 'linear-gradient(90deg, #f00, #00f) 1'
    };

    expect(css(effects)).toEqual(effects);
  });

  it('passes longhands through unchanged', () => {
    expect(css({ 'font-size': '14px', 'font-weight': 700 })).toEqual({ 'font-size': '14px', 'font-weight': 700 });
  });

  it('is idempotent', () => {
    const once = css({ gap: '24px', 'border-radius': '12px' });

    expect(css(once)).toEqual(once);
  });

  // A React style object is written that way by every agent and developer: the document keeps kebab-case either way.
  it('reads camelCase keys, and a bare number on a length as pixels', () => {
    expect(css({ paddingTop: 8, fontWeight: 800, opacity: 0.25, WebkitLineClamp: 2, gap: 0 })).toEqual({
      'padding-top': '8px',
      'font-weight': 800,
      opacity: 0.25,
      '-webkit-line-clamp': 2,
      'row-gap': '0',
      'column-gap': '0'
    });
  });

  it('refuses one property written twice under its two spellings', () => {
    expect(() => css({ paddingTop: '8px', 'padding-top': '4px' })).toThrow(/`padding-top` is written twice/);
  });

  it('takes a value per breakpoint in place, without splitting the rule set', () => {
    expect(toResponsive({ fontSize: { desktop: '24px', compact: '18px' }, fontWeight: 700 })).toEqual({
      desktop: { 'font-size': '24px', 'font-weight': 700 },
      tablet: { 'font-size': '18px' },
      mobile: { 'font-size': '18px' }
    });
  });

  it('refuses a property outside the vocabulary, and says what to do with a standard one meanwhile', () => {
    expect(() => css({ 'font-smoothing': 'antialiased' })).toThrow(/Unknown CSS property: "font-smoothing"/);
    expect(() => css({ 'font-smoothing': 'antialiased' })).toThrow(/write it in the space's `customCss`/);
  });

  /** A container query's `cqw` units measure an element that says it is a container. */
  it('takes what a container query needs', () => {
    expect(css({ containerType: 'inline-size', containerName: 'card' })).toEqual({
      'container-type': 'inline-size',
      'container-name': 'card'
    });
  });

  it('reports every unknown property at once', () => {
    expect(() => css({ nope: '1px', alsoNope: '2px' })).toThrow(/Unknown CSS properties: "nope", "also-nope"/);
    // encore-3: the classic sr-only line's `clip` was refused with no word of what replaced it.
    expect(() => css({ clip: 'rect(0, 0, 0, 0)' })).toThrow(
      /"clip" \(deprecated: write 'clip-path': 'inset\(50%\)', or the `sr-only` utility/
    );
  });

  it('allows custom properties', () => {
    expect(css({ '--brand': '#4422ee', color: 'var(--brand)' })).toEqual({
      '--brand': '#4422ee',
      color: 'var(--brand)'
    });
  });

  it('lets an explicit longhand win over the shorthand it sits beside', () => {
    expect(css({ padding: '8px', 'padding-left': '0px' })).toMatchObject({ 'padding-left': '0px' });
  });
});

describe('a style with states, variants or ancestors', () => {
  it('refuses its rules written beside them, and says to put them under `css`', () => {
    expect(() =>
      toBlocks({ desktop: { marginLeft: '10px' }, ancestors: { card: { states: { hover: { color: 'red' } } } } })
    ).toThrow(/\[rule-set-mixed\][^]*its own rules go under `css`: `\{ css: \{ desktop: … \}, ancestors: \{ … \} \}`/);
  });

  // Refused by the types too, on the key that belongs under `css` — before author runs.
  it('is refused by styles() as it is typed', () => {
    expect(() =>
      // @ts-expect-error -- `color` goes under css: once a style has variants, its own rules are { css: { … } }
      styles('mixed', { color: 'red', variants: { dark: { css: { color: 'blue' } } } })
    ).toThrow(/\[rule-set-mixed\]/);
    expect(styles('apart', { css: { color: 'red' }, variants: { dark: { css: { color: 'blue' } } } }).name).toBe(
      'apart'
    );
  });
});

describe('a style with pseudo-elements, conditions and its parent', () => {
  it('writes a pseudo-element beside the rules, and the states that show it', () => {
    const blocks = toBlocks({
      css: { color: 'gray' },
      pseudos: { after: { css: { content: '"→"', 'margin-left': '4px' }, states: { hover: { 'margin-left': '8px' } } } }
    });

    expect(blocks.desktop).toEqual({
      default: { color: 'gray' },
      pseudos: {
        after: { default: { content: '"→"', 'margin-left': '4px' }, states: { hover: { 'margin-left': '8px' } } }
      }
    });
  });

  it('refuses a pseudo-element it cannot dress, with the one meant', () => {
    expect(() => toBlocks({ pseudos: Object.fromEntries([['::before', { content: '""' }]]) })).toThrow(
      /\[style-pseudo-unknown\][^]*without the colons, "before"/
    );
    expect(() => toBlocks({ pseudos: Object.fromEntries([['befor', { content: '""' }]]) })).toThrow(
      /did you mean "before"\?/
    );
  });

  it('refuses content CSS cannot read, content where it draws nothing, and a before with none', () => {
    expect(() => toBlocks({ pseudos: { after: { content: '→' } } })).toThrow(
      /\[style-pseudo-content\][^]*content: '"→"'/
    );
    expect(() => toBlocks({ pseudos: { placeholder: { content: '"x"' } } })).toThrow(/draws nothing/);
    expect(() => toBlocks({ pseudos: { before: { color: 'red' } } })).toThrow(/has no `content`/);
    expect(() =>
      toBlocks({ pseudos: { before: { css: { color: 'red' }, states: { hover: { content: '""' } } } } })
    ).not.toThrow();
  });

  it('refuses a property the pseudo-element drops', () => {
    expect(() => toBlocks({ pseudos: { selection: { padding: '4px' } } })).toThrow(
      /\[style-pseudo-property\][^]*`padding-top` on `::selection`/
    );
    expect(() => toBlocks({ pseudos: { selection: { color: 'white', 'background-color': 'black' } } })).not.toThrow();
  });

  it('writes rules under a condition, in the spelling the document keeps', () => {
    const blocks = toBlocks({
      css: { transition: 'transform 200ms' },
      conditions: {
        'motion-reduce': { transition: 'none' },
        'container   card (max-width:30rem)': {
          css: { 'flex-direction': 'column' },
          pseudos: { after: { content: 'none' } }
        }
      }
    });

    expect(blocks.desktop?.conditions).toEqual({
      'motion-reduce': { default: { 'transition-property': 'none' } },
      'container card (max-width: 30rem)': {
        default: { 'flex-direction': 'column' },
        pseudos: { after: { default: { content: 'none' } } }
      }
    });
  });

  it('refuses a condition it cannot hold under, and one written twice', () => {
    expect(() => toBlocks({ conditions: { 'motion-reduced': { opacity: '1' } } })).toThrow(
      /\[style-condition-unknown\][^]*did you mean "motion-reduce"\?/
    );
    expect(() => toBlocks({ conditions: { 'container (width: 30rem)': { opacity: '1' } } })).toThrow(
      /min-width, max-width/
    );
    // velada-dress: dev-2 wrote the screen's width as a condition, and found the breakpoints by trying.
    expect(() => toBlocks({ conditions: { '(max-width: 480px)': { opacity: '1' } } })).toThrow(
      /The screen's width is no condition: a value per breakpoint is — `\{ desktop: …, tablet: …, mobile: …, compact: … \}`/
    );
    expect(() =>
      toBlocks({
        conditions: {
          'container (max-width: 30rem)': { opacity: '1' },
          'container (max-width:30rem)': { opacity: '0' }
        }
      })
    ).toThrow(/already writes under another spelling/);
  });

  it('keys the parent, whatever it wears, as `>`', () => {
    const blocks = toBlocks({ ancestors: { '>': { states: { expanded: { transform: 'rotate(180deg)' } } } } });

    expect(blocks.desktop?.ancestors).toEqual({ '>': { states: { expanded: { transform: 'rotate(180deg)' } } } });
    expect(() => toBlocks({ ancestors: { '> .card': { css: { color: 'red' } } } })).toThrow(/\[ancestor-not-class\]/);
  });

  // velada-backlog: `ancestors: { card: { pseudos: … } }` passed author and lint, and its CSS was never emitted.
  it('refuses what an ancestor or a state cannot hold, naming where it goes, rather than dropping it', () => {
    // The types refuse these two — a project's spread, or its JavaScript, gets past them: cast to reach the guard.
    const pseudoInAncestor = { ancestors: { card: { pseudos: { before: { opacity: '1' } } } } };
    expect(() => toBlocks(pseudoInAncestor as StyleSpec)).toThrow(/\[ancestor-shape\][\s\S]*--fill-opacity/);
    const pseudoInState = { ancestors: { card: { states: { hover: { pseudos: { before: { opacity: '1' } } } } } } };
    expect(() => toBlocks(pseudoInState as StyleSpec)).toThrow(/\[state-shape\][\s\S]*pseudos: \{ before: \{ states/);
    // la-velada's 404 arrow: a condition under an ancestor, dropped as `pseudos` was — told where it goes.
    const conditionInAncestor = {
      ancestors: { card: { conditions: { 'motion-reduce': { css: { transform: 'none' } } } } }
    };
    expect(() => toBlocks(conditionInAncestor as StyleSpec)).toThrow(
      /\[ancestor-shape\][\s\S]*conditions: \{ 'motion-reduce': \{ css: \{ transition: 'none' \} \} \}/
    );
    // …and this one they take: a state is CSS by its type, and `variants: {}` reads as a property.
    expect(() => toBlocks({ css: { color: 'red' }, states: { hover: { variants: {} } } })).toThrow(/\[state-shape\]/);
  });
});

describe('layout combinators', () => {
  it('column is the two display declarations plus the gap', () => {
    expect(column('24px')).toEqual({
      display: 'flex',
      'flex-direction': 'column',
      'row-gap': '24px',
      'column-gap': '24px'
    });
  });

  it('row takes extra rules, expanded like any other', () => {
    expect(row('8px', { padding: '4px' })).toMatchObject({
      'flex-direction': 'row',
      'padding-top': '4px',
      'padding-left': '4px'
    });
  });

  it('grid carries its template', () => {
    expect(grid('repeat(3, 1fr)', '16px')).toMatchObject({
      display: 'grid',
      'grid-template-columns': 'repeat(3, 1fr)',
      'row-gap': '16px'
    });
  });

  it('refuses an invalid extra rule at the line that wrote it', () => {
    expect(() => column('24px', { padddding: '4px' })).toThrow(/Unknown CSS property/);
  });
});

// The types refuse these; what is written without them (JS, an agent's JSON) read them as CSS values, and was told
// "`ancestors: [object Object]` is not one CSS value".
describe('a condition or a pseudo-element given a rule set’s other keys', () => {
  it('is refused naming the key and where its rule goes, never as a CSS value', () => {
    expect(() =>
      toBlocks({
        css: { color: 'red' },
        // @ts-expect-error -- a condition holds css, states and pseudos
        conditions: { 'motion-reduce': { ancestors: { '.row:hover': { css: { scale: '1' } } } } }
      })
    ).toThrow(
      /\[style-part-shape\] `conditions\['motion-reduce'\]` cannot hold `ancestors`: its rules are `css`, `states`, `pseudos`/
    );
    expect(() =>
      // @ts-expect-error -- a pseudo-element holds css and states
      toBlocks({ css: { color: 'red' }, pseudos: { before: { variants: { on: { content: '""' } } } } })
    ).toThrow(/\[style-part-shape\] `pseudos\.before` cannot hold `variants`/);
  });
});

// A gradient in a variable, written as `background`, was expanded as a colour and painted nothing.
describe('a background whose part is a bare var()', () => {
  it('is refused, naming the longhand to write — a var() inside a gradient is read as it is', () => {
    expect(() => css({ background: 'var(--hero-veil)' })).toThrow(
      /\[shorthand-ambiguous\][^]*'background-color': 'var\(--hero-veil\)' for a colour, 'background-image': 'var\(--hero-veil\)' for a gradient/
    );
    expect(() => css({ background: 'url(a.png) no-repeat, var(--x)' })).toThrow(/\[shorthand-ambiguous\]/);
    expect(() => css({ background: 'center / cover var(--x)' })).toThrow(/\[shorthand-ambiguous\]/);
    // encore-3: every side of the ON AIR plate got the whole `var(--pad, 4px 10px)`, no length at all unset.
    expect(() => css({ padding: 'var(--on-air-pad, 4px 10px)' })).toThrow(/'padding-top': 'var\(--padding-top, …\)'/);
    expect(css({ padding: 'var(--pad, 4px)' })['padding-top']).toBe('var(--pad, 4px)');
    expect(css({ padding: 'var(--y, 4px) var(--x, 10px)' })['padding-left']).toBe('var(--x, 10px)');
    expect(css({ background: 'linear-gradient(90deg, transparent, var(--accent))' })).toMatchObject({
      'background-image': 'linear-gradient(90deg, transparent, var(--accent))'
    });
    expect(css({ 'background-color': 'var(--surface)' })).toEqual({ 'background-color': 'var(--surface)' });
    expect(css({ background: 'red' })).toMatchObject({ 'background-color': 'red' });
  });

  // Refused as the declaration is made: the author's line is on the stack then, and the message names it.
  it('names the line of the author’s code that wrote it', async () => {
    const folder = mkdtempSync(path.join(os.tmpdir(), 'css-site-'));
    const file = path.join(folder, 'card.ts');
    writeFileSync(
      file,
      [
        `import { css } from ${JSON.stringify(path.resolve(import.meta.dirname, 'css.ts'))};`,
        '',
        "export const card = () => css({ background: 'var(--x)' });"
      ].join('\n')
    );
    try {
      const written: unknown = await import(file);
      const card: unknown = typeof written === 'object' && written !== null ? Reflect.get(written, 'card') : undefined;
      if (typeof card !== 'function') {
        throw new Error('the fixture exports no card');
      }

      expect(() => {
        Reflect.apply(card, undefined, []);
      }).toThrow(/\[shorthand-ambiguous\] [^\s]*card\.ts:3: `background/);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe('a font shorthand', () => {
  it('sets every longhand to a CSS-wide keyword — `font: inherit` once vanished, and a button kept the browser’s font', () => {
    expect(css({ font: 'inherit' })).toEqual({
      'font-style': 'inherit',
      'font-variant': 'inherit',
      'font-weight': 'inherit',
      'font-size': 'inherit',
      'line-height': 'inherit',
      'font-family': 'inherit'
    });
    expect(css({ padding: 'unset' })).toMatchObject({ 'padding-top': 'unset', 'padding-left': 'unset' });
  });

  it('is refused when a part is none of its longhands or its size or family is missing, naming what it does not read', () => {
    expect(() => css({ font: '600 var(--size) Sans' })).toThrow(
      /\[shorthand-unread\][^]*`var\(--size\) Sans` is none of its parts, and it has no size and no family/
    );
    expect(() => css({ font: 'bold' })).toThrow(/\[shorthand-unread\][^]*it has no size and no family;/);
    expect(css({ font: "500 16px/1.2 'DM Sans', sans-serif" })).toEqual({
      'font-weight': '500',
      'font-size': '16px',
      'line-height': '1.2',
      'font-family': "'DM Sans', sans-serif"
    });
  });
});

describe('rules written where a style has no place for them', () => {
  // Both were "`css: [object Object]` is not one CSS value", which pointed at neither. Written past the types, as
  // JavaScript or a loosely typed project reaches them.
  it('names `slots` inside `styles()` and where an element’s slots go', () => {
    expect(() => toBlocks({ css: { color: 'red' }, slots: { input: { color: 'red' } } } as never)).toThrow(
      /\[style-key-unknown\] A style holds `slots` beside `css`[^]*`slots` go on the element, beside its `class`/
    );
  });

  it('says a rule set nested as a property holds rules, and where each kind goes', () => {
    expect(() => css({ '&:hover': { color: 'blue' } } as never)).toThrow(
      /\[css-value\] `&:hover` holds rules, not a CSS value[^]*states: \{ hover/
    );
  });
});
