import { button, fontAwesome, styles, text } from '@plitzi/sdk-authoring';

import type { CssProps, ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The pieces the board's chrome is made of, declared once: a floating surface, an icon button, a caption.
 *
 * Each is a class the whole space shares — one selector, however many elements name it. A family (the tool buttons,
 * the swatches) is built by spreading one of the objects below into each member, never by stacking two classes.
 */

/** A button carries the browser's chrome and the SDK's absolute line height; every button here starts from none. */
export const BUTTON_RESET: CssProps = {
  appearance: 'none',
  margin: '0px',
  padding: '0px',
  border: '0px solid transparent',
  'background-color': 'transparent',
  color: 'inherit',
  'font-family': 'inherit',
  'font-size': 'inherit',
  'line-height': '1.2',
  cursor: 'pointer'
};

/** What floats over the board: a card that lets nothing through, above a canvas that takes every other pointer. */
/**
 * Where a popover opened from the header starts: under the header's bars (14px from the top, 46px tall) with a gap —
 * the same line for every one of them, the chat's included.
 */
export const BELOW_HEADER = '70px';

export const FLOAT: CssProps = {
  'pointer-events': 'auto',
  'background-color': 'var(--surface)',
  border: '1px solid var(--edge)',
  'border-radius': '12px',
  'box-shadow': '0 8px 28px -10px var(--shadow)'
};

export const ICON_BUTTON: CssProps = {
  ...BUTTON_RESET,
  position: 'relative',
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '36px',
  height: '36px',
  'border-radius': '8px',
  color: 'var(--ink)',
  'font-size': '15px',
  'flex-shrink': '0'
};

export const iconButton = styles('iconButton', {
  css: ICON_BUTTON,
  states: {
    hover: { 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' },
    disabled: { opacity: '0.35', cursor: 'default' }
  },
  variants: { active: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

export const iconGlyph = styles('iconGlyph', { 'pointer-events': 'none', 'line-height': '1' });

export const caption = styles('caption', {
  'font-size': '11px',
  'font-weight': '600',
  'letter-spacing': '0.04em',
  'text-transform': 'uppercase',
  color: 'var(--muted)'
});

export const divider = styles('divider', {
  width: '1px',
  height: '22px',
  margin: '0px 4px',
  'background-color': 'var(--edge)',
  'flex-shrink': '0'
});

export const icon = (name: string): ElementSpec => fontAwesome({ icon: name, class: iconGlyph });

/** A button that is only an icon — and says what it does to a screen reader and on hover. */
export const iconAction = (options: {
  id: string;
  icon: string;
  title: string;
  flow: StepSpec[];
  bind?: ElementSpec['bind'];
}): ElementSpec =>
  button({
    id: options.id,
    content: '',
    title: options.title,
    class: iconButton,
    ...(options.bind ? { bind: options.bind } : {}),
    flows: [options.flow],
    children: [icon(options.icon)]
  });

export const divide = (): ElementSpec => text({ content: '', class: divider });
