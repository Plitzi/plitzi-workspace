import {
  button,
  container,
  declaredCallback,
  onClick,
  setState,
  styles,
  text,
  variantFrom
} from '@plitzi/sdk-authoring';

import { FILLS, STROKES, STROKE_WIDTHS } from '../board/model.ts';
import boardDeclaration from '../plugins/Board/declaration.ts';
import { BOARD_ID } from './ids.ts';
import { BUTTON_RESET, FLOAT, caption } from './kit.ts';

import type { Fill, Stroke, StrokeWidth } from '../board/model.ts';
import type { CssProps, ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The style panel: what the next shape is drawn with, and — with something selected — what it is restyled to.
 *
 * One click does both, as two steps: the choice is written to the page's state, which the canvas draws new shapes
 * with, and sent to the canvas as `applyStyle`, which restyles the selection. Arranging the selection is the tools
 * beside it (`selectionTools.ts`), not this panel. The other way round, the canvas says
 * what a selection is drawn with (`onSelectionChange`) and the page writes it here, so the panel always shows the
 * style of what is in hand.
 */

export const boardAction = (
  action: Parameters<typeof declaredCallback<typeof boardDeclaration>>[1],
  params: Record<string, unknown> = {}
): StepSpec => declaredCallback(boardDeclaration, action, { on: BOARD_ID, params });

const panel = styles('stylePanel', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: '70px',
      left: '14px',
      'z-index': '3',
      display: 'flex',
      'flex-direction': 'column',
      gap: '12px',
      padding: '12px',
      // Seven fills in one row: 7 × 24px swatches and their gaps, inside the padding.
      width: '238px'
    },
    mobile: { top: '64px', left: '10px', width: '230px', padding: '10px', gap: '10px' }
  }
});

const row = styles('styleRow', { display: 'flex', 'flex-wrap': 'wrap', gap: '6px' });

const group = styles('styleGroup', { display: 'flex', 'flex-direction': 'column', gap: '6px' });

const SWATCH: CssProps = {
  ...BUTTON_RESET,
  width: '24px',
  height: '24px',
  'border-radius': '7px',
  border: '1px solid var(--edge)'
};

const SWATCH_STATES = {
  hover: { transform: 'scale(1.08)' },
  'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
};

const CHOSEN = { 'box-shadow': '0 0 0 2px var(--surface), 0 0 0 4px var(--accent)' };

/** One class per colour — a family made by spreading, so each swatch is a selector the builder shows by name. */
const swatchClass = (kind: 'stroke' | 'fill', name: string, paint: CssProps) =>
  styles(`swatch-${kind}-${name}`, {
    css: { ...SWATCH, ...paint },
    states: SWATCH_STATES,
    variants: { chosen: CHOSEN }
  });

/** No fill is drawn as the paper with a diagonal through it: the mark every drawing tool uses for "none". */
const NO_FILL = 'linear-gradient(135deg, transparent 45%, var(--danger) 45%, var(--danger) 55%, transparent 55%)';

const swatch = (kind: 'stroke' | 'fill', name: Stroke | Fill, label: string): ElementSpec => {
  const paint: CssProps =
    name === 'none'
      ? { 'background-color': 'var(--surface)', 'background-image': NO_FILL }
      : { 'background-color': kind === 'stroke' ? `var(--${name})` : `var(--fill-${name})` };
  const style = swatchClass(kind, name, paint);

  return button({
    id: `${kind}-${name}`,
    content: '',
    title: label,
    class: style,
    bind: [variantFrom(style, `computed.${kind}`, { template: `{{ source == '${name}' ? 'chosen' : '' }}` })],
    flows: [
      [onClick(), setState({ key: kind, type: 'text', value: name }), boardAction('applyStyle', { [kind]: name })]
    ]
  });
};

const widthButton = styles('widthButton', {
  css: {
    ...BUTTON_RESET,
    flex: '1',
    height: '30px',
    'border-radius': '7px',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    'background-color': 'var(--surface-2)'
  },
  states: { hover: { 'background-color': 'var(--edge)' }, 'focus-visible': { outline: '2px solid var(--accent)' } },
  variants: { chosen: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

/** The line each width button shows, as thick as the width it picks. */
const widthStroke = (value: StrokeWidth) =>
  styles(`widthStroke-${value}`, {
    display: 'block',
    width: '22px',
    height: `${value + 1}px`,
    'border-radius': '4px',
    'background-color': 'currentColor',
    'pointer-events': 'none'
  });

const WIDTH_LABELS: Record<StrokeWidth, string> = { 1: 'Thin', 2: 'Bold', 4: 'Extra bold' };

const width = (value: StrokeWidth): ElementSpec =>
  button({
    id: `width-${value}`,
    content: '',
    title: WIDTH_LABELS[value],
    class: widthButton,
    bind: [variantFrom(widthButton, 'computed.strokeWidth', { template: `{{ source == ${value} ? 'chosen' : '' }}` })],
    flows: [
      [
        onClick(),
        setState({ key: 'strokeWidth', type: 'number', value }),
        boardAction('applyStyle', { strokeWidth: String(value) })
      ]
    ],
    children: [text({ content: '', class: widthStroke(value) })]
  });

const STROKE_LABELS: Record<Stroke, string> = {
  ink: 'Ink',
  red: 'Red',
  orange: 'Orange',
  green: 'Green',
  blue: 'Blue',
  violet: 'Violet'
};

const FILL_LABELS: Record<Fill, string> = {
  none: 'No fill',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  violet: 'Violet'
};

export const stylePanel = (): ElementSpec =>
  container({
    id: 'style-panel',
    class: panel,
    visible: 'computed.styleOpen',
    children: [
      container({
        class: group,
        children: [
          text({ content: 'Stroke', class: caption }),
          container({ class: row, children: STROKES.map(name => swatch('stroke', name, STROKE_LABELS[name])) })
        ]
      }),
      container({
        class: group,
        children: [
          text({ content: 'Fill', class: caption }),
          container({ class: row, children: FILLS.map(name => swatch('fill', name, FILL_LABELS[name])) })
        ]
      }),
      container({
        class: group,
        children: [
          text({ content: 'Width', class: caption }),
          container({ class: row, children: STROKE_WIDTHS.map(width) })
        ]
      })
    ]
  });
