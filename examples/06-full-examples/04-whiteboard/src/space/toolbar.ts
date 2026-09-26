import { button, container, onClick, onKey, setState, styles, text, variantFrom } from '@plitzi/sdk-authoring';

import { FLOAT, ICON_BUTTON, divide, icon } from './kit.ts';

import type { Tool } from '../plugins/Board/controller.ts';
import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The tools, as the person reaches them: a bar at the top of the board and a key each.
 *
 * The tool in hand is the page's state (`state.tool`), not the canvas's. The bar lights the button for it, the
 * canvas draws with it, and the canvas says when it moves on by itself — back to select after a shape — through
 * `onToolChange`, which writes the same key.
 */
export const TOOLS: readonly { tool: Tool; icon: string; label: string; keys: string; hint: string }[] = [
  { tool: 'hand', icon: 'fa-regular fa-hand', label: 'Hand — pan the board', keys: 'h', hint: 'H' },
  { tool: 'select', icon: 'fa-solid fa-arrow-pointer', label: 'Select', keys: 'v, 1', hint: '1' },
  { tool: 'rectangle', icon: 'fa-regular fa-square', label: 'Rectangle', keys: 'r, 2', hint: '2' },
  { tool: 'diamond', icon: 'fa-solid fa-diamond', label: 'Diamond', keys: 'd, 3', hint: '3' },
  { tool: 'ellipse', icon: 'fa-regular fa-circle', label: 'Ellipse', keys: 'o, 4', hint: '4' },
  { tool: 'arrow', icon: 'fa-solid fa-arrow-right-long', label: 'Arrow', keys: 'a, 5', hint: '5' },
  { tool: 'line', icon: 'fa-solid fa-minus', label: 'Line', keys: 'l, 6', hint: '6' },
  { tool: 'freehand', icon: 'fa-solid fa-pencil', label: 'Pen', keys: 'p, 7', hint: '7' },
  { tool: 'text', icon: 'fa-solid fa-font', label: 'Text', keys: 't, 8', hint: '8' },
  { tool: 'sticky', icon: 'fa-regular fa-note-sticky', label: 'Sticky note', keys: 's, 9', hint: '9' },
  { tool: 'eraser', icon: 'fa-solid fa-eraser', label: 'Eraser', keys: 'e, 0', hint: '0' }
];

export const useTool = (tool: Tool): StepSpec => setState({ key: 'tool', type: 'text', value: tool });

/** A key per tool — heard on the whole page, and ignored while somebody types in a field. */
export const toolKeys: StepSpec[][] = TOOLS.map(entry => [onKey(entry.keys), useTool(entry.tool)]);

const bar = styles('toolbar', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      'z-index': '3',
      display: 'flex',
      'align-items': 'center',
      gap: '2px',
      padding: '5px'
    },
    // Along the bottom on a phone: where a thumb is, and out of the way of the title.
    mobile: {
      top: 'auto',
      bottom: '14px',
      gap: '0px',
      padding: '4px',
      'max-width': 'calc(100vw - 24px)',
      'overflow-x': 'auto',
      'scrollbar-width': 'none'
    }
  }
});

const toolButton = styles('toolButton', {
  // Eleven tools across a phone: a little smaller there, so the whole bar fits a 390px screen.
  css: { desktop: ICON_BUTTON, mobile: { width: '31px', height: '34px', 'font-size': '14px' } },
  states: {
    hover: { 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' }
  },
  variants: { active: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

const keyHint = styles('keyHint', {
  css: {
    desktop: {
      position: 'absolute',
      right: '3px',
      bottom: '1px',
      'font-size': '9px',
      'font-weight': '600',
      color: 'var(--muted)',
      'pointer-events': 'none'
    },
    mobile: { display: 'none' }
  }
});

const toolButtonFor = (entry: (typeof TOOLS)[number]): ElementSpec =>
  button({
    id: `tool-${entry.tool}`,
    content: '',
    title: `${entry.label} — ${entry.hint}`,
    class: toolButton,
    bind: [variantFrom(toolButton, 'computed.tool', { template: `{{ source == '${entry.tool}' ? 'active' : '' }}` })],
    flows: [[onClick(), useTool(entry.tool)]],
    children: [icon(entry.icon), text({ content: entry.hint, class: keyHint })]
  });

export const toolbar = (): ElementSpec => {
  const [hand, ...drawing] = TOOLS;

  return container({
    id: 'toolbar',
    class: bar,
    children: [toolButtonFor(hand), divide(), ...drawing.map(toolButtonFor)]
  });
};
