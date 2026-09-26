import {
  button,
  container,
  declaredTrigger,
  defineElement,
  form,
  formControl,
  named,
  navigate,
  onClick,
  onSubmit,
  paragraph,
  setState,
  styles,
  text,
  variantFrom
} from '@plitzi/sdk-authoring';

import { connect, drawing, loop, scribble, sticky } from '../../board/sketch.ts';
import declaration from '../../plugins/Board/declaration.ts';
import { newBoardFlow, primaryButton } from '../board.ts';
import { BUTTON_RESET, FLOAT, ICON_BUTTON, icon } from '../kit.ts';

import type { Tool } from '../../plugins/Board/controller.ts';
import type { BoardAttributes } from '../../plugins/Board/declaration.ts';
import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * The first thing on the front page: what this is, in a sentence and a button — and, beside it, a board to try it on
 * before deciding anything. The sandbox is the real canvas, with no channel and no action behind it: whatever is
 * drawn there stays on this screen, and a reload starts it over.
 */

const board = defineElement<BoardAttributes>(declaration);

/** What the sandbox greets a visitor with: a few things to grab, drawn the way a person would. */
const welcome = (): ReturnType<typeof drawing> => {
  const note = 'hero-note-1';
  const shape = 'hero-shape-1';

  return drawing([
    { ...sticky(40, 40, 'Drag me around! Double-click to write', 'yellow'), id: note },
    {
      id: shape,
      type: 'ellipse',
      x: 380,
      y: 70,
      width: 220,
      height: 120,
      fill: 'violet',
      text: 'Arrows stick to shapes'
    },
    connect(note, 'e', shape, 'w'),
    { ...sticky(420, 250, 'Pick the pen and scribble ✏️', 'green') },
    loop(420, 250, 200, 200, 'red', 29),
    scribble(
      [
        [80, 330],
        [120, 300],
        [170, 340],
        [220, 300],
        [270, 340]
      ],
      'blue',
      31
    ),
    { type: 'text', x: 80, y: 360, text: 'nothing here is saved', strokeWidth: 1 }
  ]);
};

const section = styles('hero', {
  css: {
    desktop: {
      display: 'grid',
      'grid-template-columns': 'minmax(0px, 1fr) minmax(0px, 1.15fr)',
      'align-items': 'center',
      gap: '48px',
      'padding-top': '24px'
    },
    compact: { 'grid-template-columns': 'minmax(0px, 1fr)', gap: '28px' }
  }
});

const pitch = styles('heroPitch', {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'flex-start',
  gap: '20px'
});

const eyebrow = styles('heroEyebrow', {
  display: 'inline-flex',
  'align-items': 'center',
  gap: '8px',
  padding: '6px 12px',
  'border-radius': '999px',
  'font-size': '12px',
  'font-weight': '600',
  color: 'var(--accent)',
  'background-color': 'var(--accent-soft)'
});

const liveDot = styles('liveDot', {
  width: '8px',
  height: '8px',
  'border-radius': '50%',
  'background-color': 'var(--green)',
  'box-shadow': '0 0 0 4px color-mix(in srgb, var(--green) 25%, transparent)'
});

const headline = styles('heroTitle', {
  css: {
    desktop: {
      margin: '0px',
      'font-family': 'var(--hand)',
      'font-size': '76px',
      'font-weight': '700',
      'line-height': '1',
      color: 'var(--ink)'
    },
    mobile: { 'font-size': '48px' }
  }
});

const highlight = styles('heroHighlight', {
  'background-image': 'linear-gradient(transparent 62%, var(--fill-yellow) 62%)',
  padding: '0px 4px'
});

const lead = styles('heroLead', {
  margin: '0px',
  'max-width': '520px',
  'font-size': '18px',
  'line-height': '1.55',
  color: 'var(--muted)'
});

const actions = styles('heroActions', { display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'center', gap: '12px' });

const joinForm = styles('joinForm', {
  display: 'flex',
  'align-items': 'center',
  gap: '6px',
  padding: '4px',
  'border-radius': '12px',
  border: '1px solid var(--edge)',
  'background-color': 'var(--surface)'
});

const joinBox = styles('joinBox', {
  css: { display: 'flex', 'align-items': 'center', height: '34px', padding: '0px 8px' }
});

const joinField = styles('joinField', { width: '190px' });

const joinGo = styles('joinGo', {
  css: {
    ...BUTTON_RESET,
    height: '34px',
    padding: '0px 12px',
    'border-radius': '8px',
    'font-weight': '600',
    'font-size': '13px',
    'background-color': 'var(--surface-2)'
  },
  states: { hover: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

const perks = styles('heroPerks', {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: '8px 18px',
  'font-size': '13px',
  color: 'var(--muted)'
});

const perk = styles('heroPerk', { display: 'inline-flex', 'align-items': 'center', gap: '6px' });

const sandboxFrame = styles('sandboxFrame', {
  ...FLOAT,
  position: 'relative',
  overflow: 'hidden',
  'border-radius': '18px',
  'box-shadow': '0 30px 60px -30px var(--shadow), 0 0 0 1px var(--edge)'
});

const sandboxBar = styles('sandboxBar', {
  display: 'flex',
  'align-items': 'center',
  gap: '4px',
  padding: '8px 10px',
  'border-bottom': '1px solid var(--edge)',
  'background-color': 'var(--surface)'
});

const sandboxLabel = styles('sandboxLabel', {
  'margin-left': 'auto',
  'font-size': '12px',
  'font-weight': '600',
  color: 'var(--muted)'
});

const sandboxTool = styles('sandboxTool', {
  css: { ...ICON_BUTTON, width: '32px', height: '32px', 'font-size': '14px' },
  states: { hover: { 'background-color': 'var(--surface-2)' } },
  variants: { active: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

/** The sandbox's canvas: `boardCanvas`'s colours (in `css.ts`), a fixed height to play in. */
const sandboxCanvas = styles('sandboxCanvas', {
  css: { desktop: { position: 'relative', height: '440px' }, mobile: { height: '340px' } }
});

const SANDBOX_TOOLS: readonly { tool: Tool; icon: string; label: string }[] = [
  { tool: 'select', icon: 'fa-solid fa-arrow-pointer', label: 'Select' },
  { tool: 'freehand', icon: 'fa-solid fa-pencil', label: 'Pen' },
  { tool: 'sticky', icon: 'fa-regular fa-note-sticky', label: 'Sticky note' },
  { tool: 'rectangle', icon: 'fa-regular fa-square', label: 'Rectangle' },
  { tool: 'arrow', icon: 'fa-solid fa-arrow-right-long', label: 'Arrow' },
  { tool: 'laser', icon: 'fa-solid fa-wand-magic-sparkles', label: 'Laser' }
];

/** The real canvas, with nothing behind it: no channel to share on, no action to keep with. */
const sandboxBoard = (): ElementSpec =>
  board({
    id: 'sandbox-canvas',
    runtime: 'client',
    class: styles('sandboxBoard', { position: 'absolute', inset: '0px' }),
    boardId: 'sandbox',
    mode: 'edit',
    elements: welcome(),
    bind: [
      { to: 'tool', source: 'computed.sandboxTool' },
      { to: 'scheme', source: 'theme.resolved' }
    ],
    // The canvas moves on to select after a shape; the tool chips follow it.
    flows: [
      [
        named('switched', declaredTrigger(declaration, 'onToolChange')),
        setState({ key: 'sandboxTool', type: 'text', value: '{{ switched.tool }}' })
      ]
    ]
  });

const sandbox = (): ElementSpec =>
  container({
    id: 'sandbox',
    class: sandboxFrame,
    children: [
      container({
        class: sandboxBar,
        children: [
          ...SANDBOX_TOOLS.map(entry =>
            button({
              id: `sandbox-${entry.tool}`,
              content: '',
              title: entry.label,
              class: sandboxTool,
              bind: [
                variantFrom(sandboxTool, 'computed.sandboxTool', {
                  template: `{{ source == '${entry.tool}' ? 'active' : '' }}`
                })
              ],
              flows: [[onClick(), setState({ key: 'sandboxTool', type: 'text', value: entry.tool })]],
              children: [icon(entry.icon)]
            })
          ),
          text({ content: 'Try it here — this one is yours', class: sandboxLabel })
        ]
      }),
      container({ class: sandboxCanvas, children: [sandboxBoard()] })
    ]
  });

/** A link or a code pasted in: the last part of either is the board's id. */
const join = (): ElementSpec =>
  form({
    id: 'join',
    class: joinForm,
    managedByInteractions: true,
    noValidate: true,
    flows: [
      [
        named('joining', onSubmit()),
        navigate({ urlType: 'internal', url: "/b/{{ joining.values.code|trim|split('/')|last }}" })
      ]
    ],
    children: [
      formControl({
        id: 'join-code',
        name: 'code',
        label: '',
        placeholder: 'Paste a board link or code',
        required: false,
        autoComplete: false,
        class: joinField,
        slots: { input: joinBox }
      }),
      button({ id: 'join-go', subType: 'submit', content: 'Join', class: joinGo })
    ]
  });

export const hero = (): ElementSpec =>
  container({
    class: section,
    children: [
      container({
        class: pitch,
        children: [
          container({
            class: eyebrow,
            children: [text({ content: '', class: liveDot }), text({ content: 'Live · free · no sign-up' })]
          }),
          container({
            subType: 'h1',
            class: headline,
            children: [text({ content: 'Draw ' }), text({ content: 'together.', class: highlight })]
          }),
          paragraph({
            content:
              'An infinite whiteboard in a hand-drawn stroke. Start a board, send the link, and everyone on it sees every shape, cursor and sticky note the moment it happens.',
            class: lead
          }),
          container({
            class: actions,
            children: [
              button({
                id: 'new-board',
                content: 'Start a blank board',
                class: primaryButton,
                flows: [newBoardFlow],
                children: [icon('fa-solid fa-plus')]
              }),
              join()
            ]
          }),
          container({
            class: perks,
            children: [
              ['fa-solid fa-arrow-pointer', 'Live cursors'],
              ['fa-regular fa-note-sticky', 'Sticky piles'],
              ['fa-regular fa-image', 'Paste images'],
              ['fa-solid fa-lock', 'Password boards'],
              ['fa-regular fa-clock', 'Shared timer']
            ].map(([glyph, label]) => container({ class: perk, children: [icon(glyph), text({ content: label })] }))
          })
        ]
      }),
      sandbox()
    ]
  });
