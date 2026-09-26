import { button, fontAwesome, styles, text } from '@plitzi/sdk-authoring';

import type { CssProps, ElementSpec, StatesSpec, StepSpec, StyleDeclaration } from '@plitzi/sdk-authoring';

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

// ── Motion ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * How the chrome moves, one vocabulary for all of it. What appears comes out of the side it was asked from with a
 * little spring, and goes back quicker and plainer: the way in draws the eye, the way out gets out of the way. What a
 * panel holds follows it in a beat later, one item after the next ({@link RISE}). A visitor who asked for less motion
 * gets none (`css.ts`).
 */
export const SPRING = 'cubic-bezier(0.34, 1.32, 0.64, 1)';

const LEAVE = 'cubic-bezier(0.4, 0, 1, 1)';

const ARRIVE_MS = 240;

const LEAVE_MS = 130;

/** Where a panel comes out of: the side its button is on — or, for one in the middle of the screen, nowhere. */
export type Side = 'above' | 'below' | 'left' | 'right' | 'centre';

const OFFSET: Record<Side, string> = {
  above: 'translateY(-8px)',
  below: 'translateY(8px)',
  left: 'translateX(-8px)',
  right: 'translateX(14px)',
  centre: ''
};

const ORIGIN: Record<Side, string> = {
  above: 'top center',
  below: 'bottom center',
  left: 'left center',
  right: 'right center',
  centre: 'center'
};

// `display` among what moves, and allow-discrete: a panel stays drawn while it fades out, and starts faded as it shows.
const moving = (ms: number, ease: string): string =>
  `opacity ${ms}ms ${ease}, transform ${ms}ms ${ease}, display ${ms}ms allow-discrete`;

/**
 * Where a panel comes out of: the side, the transform it holds to be placed (a centred one's `translateX(-50%)`, kept
 * under the motion's), and the point it grows from — its button's corner, for one hung from a corner of the header.
 */
export type Appearing = { from: Side; rest?: string; origin?: string };

/** A panel's motion: the CSS its class adds, and the look it has while hidden — where it goes, and comes from. */
export const appears = ({
  from,
  rest = '',
  origin = ORIGIN[from]
}: Appearing): { css: CssProps; hidden: CssProps } => ({
  css: { transition: moving(ARRIVE_MS, SPRING), 'transform-origin': origin },
  hidden: {
    opacity: '0',
    transform: [rest, OFFSET[from], 'scale(0.96)'].filter(Boolean).join(' '),
    transition: moving(LEAVE_MS, LEAVE)
  }
});

/**
 * A panel that moves, as a class's `css` and `states`: its placement per breakpoint, and the side it comes out of on
 * each — a flyout beside the bar on a desktop comes up from the bar at the foot of a phone.
 */
export const panelMotion = (
  desktop: Appearing,
  mobile: Appearing = desktop
): { desktop: CssProps; mobile: CssProps; states: StatesSpec } => {
  const wide = appears(desktop);
  const narrow = appears(mobile);

  return {
    desktop: wide.css,
    mobile: narrow.css,
    states: { hidden: { desktop: wide.hidden, mobile: narrow.hidden } }
  };
};

/** What only fades — a veil over the board behind a dialog: no side to come from, nothing to grow. */
export const FADES: { css: CssProps; states: StatesSpec } = {
  css: { transition: `opacity ${ARRIVE_MS}ms ease, display ${ARRIVE_MS}ms allow-discrete` },
  states: {
    hidden: { opacity: '0', transition: `opacity ${LEAVE_MS}ms ${LEAVE}, display ${LEAVE_MS}ms allow-discrete` }
  }
};

/**
 * What a panel holds, rising in after it: an animation rather than a transition, so the wait before it never slows the
 * item's own hover. `--i` — worn by each item ({@link riseAt}) — is its place in line.
 */
export const RISE: CssProps = {
  animation: `wb-enter 280ms ${SPRING} backwards`,
  'animation-delay': 'calc(40ms + var(--i, 0) * 18ms)'
};

/** Past the tenth, items rise with the tenth: a long list is not kept waiting. */
const RISE_PLACES = 10;

const RISE_CLASSES = Array.from({ length: RISE_PLACES + 1 }, (_, place) =>
  styles(`riseAt${place}`, { '--i': String(place) })
);

/**
 * An item's place in line as it rises in: a class of its own beside the one it shares — the only modifier worn that
 * way here, since it says nothing but the order and the element may carry no CSS of its own beside a class.
 */
export const riseAt = (index: number): StyleDeclaration => RISE_CLASSES[Math.min(index, RISE_PLACES)];

export const ICON_BUTTON: CssProps = {
  ...BUTTON_RESET,
  transition: 'background-color 140ms ease, color 140ms ease, transform 140ms ease',
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

/** A button being pressed gives a little under the pointer. */
export const PRESSED: CssProps = { transform: 'scale(0.92)' };

export const iconButton = styles('iconButton', {
  css: ICON_BUTTON,
  states: {
    hover: { 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' },
    active: PRESSED,
    disabled: { opacity: '0.35', cursor: 'default', transform: 'none' }
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
