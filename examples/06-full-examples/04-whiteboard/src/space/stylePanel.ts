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

import { BOARD_ID } from './ids.ts';
import { BUTTON_RESET, FLOAT, caption, icon } from './kit.ts';
import { FILLS, STROKES, STROKE_WIDTHS } from '../board/model.ts';
import boardDeclaration from '../plugins/Board/declaration.ts';

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
      top: '50%',
      left: '72px',
      transform: 'translateY(-50%)',
      'z-index': '3',
      display: 'flex',
      'flex-direction': 'column',
      gap: '12px',
      padding: '12px',
      // Seven fills in one row: 7 × 24px swatches and their gaps, inside the padding.
      width: '238px',
      'max-height': 'calc(100dvh - 150px)',
      'overflow-y': 'auto',
      'scrollbar-width': 'thin'
    },
    mobile: {
      top: '64px',
      left: '10px',
      transform: 'none',
      width: '230px',
      padding: '10px',
      gap: '10px',
      'max-height': 'calc(100dvh - 160px)'
    }
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

/** A picture of what an option draws, made of CSS: a line in its dash, a square with its corners, a fill's pattern. */
const preview = (name: string, css: CssProps) =>
  styles(`stylePreview-${name}`, { display: 'block', 'pointer-events': 'none', ...css });

const LINE: CssProps = { width: '22px', height: '0px', 'border-top-width': '2px', 'border-top-color': 'currentColor' };

const SQUARE: CssProps = { width: '16px', height: '16px', border: '2px solid currentColor' };

const HATCH = 'currentColor 0px, currentColor 1.5px, transparent 1.5px, transparent 5px';

type Option = { value: string; label: string; mark: ElementSpec };

const glyphMark = styles('styleGlyph', { 'font-size': '17px', 'line-height': '1', 'pointer-events': 'none' });

const glyph = (content: string): ElementSpec => text({ content, class: glyphMark });

/**
 * A choice among a few, for one field: each button writes the page's state (what the next shape is drawn with) and
 * restyles the selection (`applyStyle`) — the same two steps as a colour.
 */
const choices = (field: string, state: 'text' | 'number', options: readonly Option[]): ElementSpec =>
  container({
    class: row,
    children: options.map(option =>
      button({
        id: `${field}-${option.value}`,
        content: '',
        title: option.label,
        class: widthButton,
        bind: [
          variantFrom(widthButton, `computed.${field}`, {
            template: `{{ source == '${option.value}' ? 'chosen' : '' }}`
          })
        ],
        flows: [
          [
            onClick(),
            setState({ key: field, type: state, value: state === 'number' ? Number(option.value) : option.value }),
            boardAction('applyStyle', { [field]: option.value })
          ]
        ],
        children: [option.mark]
      })
    )
  });

const DASH_OPTIONS: readonly Option[] = [
  {
    value: 'solid',
    label: 'Solid',
    mark: text({ content: '', class: preview('solid', { ...LINE, 'border-top-style': 'solid' }) })
  },
  {
    value: 'dashed',
    label: 'Dashed',
    mark: text({ content: '', class: preview('dashed', { ...LINE, 'border-top-style': 'dashed' }) })
  },
  {
    value: 'dotted',
    label: 'Dotted',
    mark: text({ content: '', class: preview('dotted', { ...LINE, 'border-top-style': 'dotted' }) })
  }
];

const SLOPPINESS_OPTIONS: readonly Option[] = [
  { value: 'architect', label: 'Architect — clean lines', mark: glyph('—') },
  { value: 'artist', label: 'Artist — a hand’s wobble', mark: glyph('∼') },
  { value: 'cartoonist', label: 'Cartoonist — loose and lively', mark: glyph('≈') }
];

const BRUSH_OPTIONS: readonly Option[] = [
  { value: 'pizarra', label: 'Pizarra — our own ink', icon: 'fa-solid fa-pen' },
  { value: 'brush', label: 'Japanese brush — swells and tapers', icon: 'fa-solid fa-paintbrush' },
  { value: 'fountain', label: 'Fountain pen', icon: 'fa-solid fa-pen-fancy' },
  { value: 'marker', label: 'Marker — even and bold', icon: 'fa-solid fa-marker' },
  { value: 'highlighter', label: 'Highlighter — see-through', icon: 'fa-solid fa-highlighter' },
  { value: 'pencil', label: 'Pencil — fine grain', icon: 'fa-solid fa-pencil' },
  { value: 'chalk', label: 'Chalk — dusty', icon: 'fa-solid fa-chalkboard' },
  { value: 'neon', label: 'Neon — it glows', icon: 'fa-solid fa-bolt' }
].map(({ value, label, icon: name }) => ({ value, label, mark: icon(name) }));

const EDGE_OPTIONS: readonly Option[] = [
  { value: 'sharp', label: 'Sharp corners', mark: text({ content: '', class: preview('sharp', SQUARE) }) },
  {
    value: 'round',
    label: 'Round corners',
    mark: text({ content: '', class: preview('round', { ...SQUARE, 'border-radius': '6px' }) })
  }
];

const FILL_STYLE_OPTIONS: readonly Option[] = [
  {
    value: 'hachure',
    label: 'Hachure',
    mark: text({
      content: '',
      class: preview('hachure', { ...SQUARE, 'background-image': `repeating-linear-gradient(135deg, ${HATCH})` })
    })
  },
  {
    value: 'cross',
    label: 'Cross-hatch',
    mark: text({
      content: '',
      class: preview('cross', {
        ...SQUARE,
        'background-image': `repeating-linear-gradient(135deg, ${HATCH}), repeating-linear-gradient(45deg, ${HATCH})`
      })
    })
  },
  {
    value: 'solid',
    label: 'Solid',
    mark: text({ content: '', class: preview('solidFill', { ...SQUARE, 'background-color': 'currentColor' }) })
  }
];

const OPACITY_OPTIONS: readonly Option[] = [20, 40, 60, 80, 100].map(value => ({
  value: String(value),
  label: `Opacity ${value}%`,
  mark: text({
    content: String(value),
    class: styles('opacityMark', { 'font-size': '11px', 'font-weight': '600', 'pointer-events': 'none' })
  })
}));

/** A section of the panel: its name, and what it offers — shown only for what is selected, or the tool in hand. */
const section = (label: string, shown: string, children: ElementSpec[]): ElementSpec =>
  container({ class: group, visible: shown, children: [text({ content: label, class: caption }), ...children] });

const layers = (): ElementSpec =>
  container({
    class: row,
    children: [
      { id: 'layer-back', icon: 'fa-solid fa-angles-down', title: 'Send to back — [', action: 'sendToBack' as const },
      {
        id: 'layer-backward',
        icon: 'fa-solid fa-angle-down',
        title: 'Send backward — ⌘[',
        action: 'sendBackward' as const
      },
      {
        id: 'layer-forward',
        icon: 'fa-solid fa-angle-up',
        title: 'Bring forward — ⌘]',
        action: 'bringForward' as const
      },
      { id: 'layer-front', icon: 'fa-solid fa-angles-up', title: 'Bring to front — ]', action: 'bringToFront' as const }
    ].map(entry =>
      button({
        id: entry.id,
        content: '',
        title: entry.title,
        class: widthButton,
        flows: [[onClick(), boardAction(entry.action)]],
        children: [icon(entry.icon)]
      })
    )
  });

/**
 * Excalidraw's properties, section by section: stroke, background, fill style, width, stroke style, sloppiness, edges,
 * opacity and layers — each shown only where what is selected (or the tool in hand) takes it.
 */
export const stylePanel = (): ElementSpec =>
  container({
    id: 'style-panel',
    class: panel,
    visible: 'computed.styleOpen',
    children: [
      section('Stroke', 'computed.showStroke', [
        container({ class: row, children: STROKES.map(name => swatch('stroke', name, STROKE_LABELS[name])) })
      ]),
      section('Background', 'computed.showFill', [
        container({ class: row, children: FILLS.map(name => swatch('fill', name, FILL_LABELS[name])) })
      ]),
      section('Fill', 'computed.showFillStyle', [choices('fillStyle', 'text', FILL_STYLE_OPTIONS)]),
      section('Stroke width', 'computed.showWidth', [container({ class: row, children: STROKE_WIDTHS.map(width) })]),
      section('Stroke style', 'computed.showDash', [choices('dash', 'text', DASH_OPTIONS)]),
      section('Brush', 'computed.showBrush', [choices('brush', 'text', BRUSH_OPTIONS)]),
      section('Sloppiness', 'computed.showSloppiness', [choices('sloppiness', 'text', SLOPPINESS_OPTIONS)]),
      section('Edges', 'computed.showEdges', [choices('edges', 'text', EDGE_OPTIONS)]),
      section('Opacity', 'computed.showOpacity', [choices('opacity', 'number', OPACITY_OPTIONS)]),
      section('Layers', 'computed.showLayers', [layers()])
    ]
  });
