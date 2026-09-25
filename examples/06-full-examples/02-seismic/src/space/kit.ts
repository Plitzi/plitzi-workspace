import { bindTemplate, button, container, styles, text, variantFrom } from '@plitzi/sdk-authoring';

import type { CssProps, ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The pieces every panel of the display is made of, declared once.
 *
 * A panel, the caption on top of it, a readout, a chip. Each is a class the whole space shares — one selector, however
 * many elements name it, so restyling the chips restyles every chip — and a small function where the same TREE
 * repeats. The panels themselves live in the files beside this one, one per part of the display.
 */

/**
 * A button carries the browser's own chrome — and the SDK's `line-height`, an absolute 24px — so a chip, a row and a
 * card are buttons that look like none of it. Spread first into every class a `button` wears.
 */
export const BUTTON_RESET: CssProps = {
  appearance: 'none',
  margin: '0px',
  border: '1px solid transparent',
  'border-radius': '0px',
  'background-color': 'transparent',
  color: 'inherit',
  'font-family': 'inherit',
  'font-size': 'inherit',
  'line-height': '1.3',
  'text-align': 'left',
  cursor: 'pointer'
};

/**
 * The surface every panel sits on: a tinted glass over the globe, with a hairline in the trace colour.
 *
 * Exported as rules as well as a class, because every panel of the display is this plus something — and a family is
 * built by spreading one object into each member, never by stacking two classes on one element.
 */
export const PANEL: CssProps = {
  position: 'relative',
  'pointer-events': 'auto',
  'background-color': 'var(--panel)',
  border: '1px solid var(--edge)',
  'backdrop-filter': 'blur(10px)',
  padding: '14px 16px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
  'min-width': '0px'
};

export const panel = styles('panel', PANEL);

export const caption = styles('caption', {
  'font-family': 'var(--mono)',
  'font-size': '10px',
  'letter-spacing': '0.24em',
  'text-transform': 'uppercase',
  color: 'var(--dim)'
});

/** A caption in the trace colour: what a panel IS, as opposed to what one of its numbers is. */
export const title = styles('title', {
  'font-family': 'var(--mono)',
  'font-size': '10px',
  'font-weight': '700',
  'letter-spacing': '0.28em',
  'text-transform': 'uppercase',
  color: 'var(--trace)',
  // A panel's name never wraps: whatever sits beside it — a count, a scope — gives way instead.
  'white-space': 'nowrap',
  'flex-shrink': '0'
});

export const headRow = styles('headRow', {
  display: 'flex',
  'align-items': 'baseline',
  'justify-content': 'space-between',
  gap: '12px',
  'text-align': 'right'
});

/** The big numbers. Tabular, so a count that ticks from 99 to 100 on a refresh does not shift everything beside it. */
export const readout = styles('readout', {
  'font-family': 'var(--display)',
  'font-size': '24px',
  'font-weight': '700',
  'line-height': '1',
  'letter-spacing': '0.02em',
  color: 'var(--trace)',
  'font-variant-numeric': 'tabular-nums'
});

export const body = styles('body', {
  'font-family': 'var(--mono)',
  'font-size': '12px',
  'line-height': '1.5',
  color: 'var(--ink)'
});

export const chip = styles('chip', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    gap: '6px',
    'min-height': '28px',
    padding: '0px 9px',
    'font-family': 'var(--mono)',
    'font-size': '10.5px',
    'font-weight': '500',
    'letter-spacing': '0.1em',
    'text-decoration': 'none',
    'white-space': 'nowrap',
    color: 'var(--dim)',
    'background-color': 'var(--cell)',
    transition: 'color 120ms linear, background-color 120ms linear, border-color 120ms linear'
  },
  states: {
    hover: { color: 'var(--trace)', 'border-color': 'var(--edge)' },
    'focus-visible': { outline: '1px solid var(--trace)', 'outline-offset': '2px' }
  },
  // The chosen chip is a different SHAPE, not the same one tinted: it is a position of a switch, not an emphasis.
  variants: {
    on: {
      color: 'var(--void)',
      'background-color': 'var(--trace)',
      'font-weight': '700',
      'border-color': 'var(--trace)'
    }
  }
});

/** A row of chips that reads as one switch: a hairline between them instead of a gap. */
export const segmented = styles('segmented', {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: '1px',
  'pointer-events': 'auto'
});

export const label = (content: string, id?: string): ElementSpec =>
  text({ content, class: caption, ...(id ? { id } : {}) });

export const heading = (content: string, meta?: ElementSpec): ElementSpec =>
  container({ class: headRow, children: [text({ content, class: title }), ...(meta ? [meta] : [])] });

/**
 * One chip of a switch whose position is in `state`.
 *
 * `on` is the template that says whether THIS chip is the chosen one; it reads a computed value rather than the raw
 * state, so a switch nobody has touched yet still shows its default as chosen.
 */
export const chipButton = (params: {
  id: string;
  content: string;
  hint: string;
  source: string;
  on: string;
  flow: StepSpec[];
  /** A mark drawn before the label — a colour swatch. The label then becomes a child, beside it. */
  lead?: ElementSpec;
}): ElementSpec =>
  button({
    id: params.id,
    content: params.lead ? '' : params.content,
    ...(params.lead ? { children: [params.lead, text(params.content)] } : {}),
    title: params.hint,
    class: chip,
    bind: [
      variantFrom(chip, params.source, { template: `{{ ${params.on} ? 'on' : '' }}` }),
      bindTemplate('ariaPressed', params.source, `{{ ${params.on} ? 'true' : 'false' }}`)
    ],
    flows: [params.flow]
  });
