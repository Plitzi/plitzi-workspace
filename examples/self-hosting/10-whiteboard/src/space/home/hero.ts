import {
  button,
  container,
  declaredTrigger,
  defineElement,
  fontAwesome,
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
import { BUTTON_RESET, FLOAT, ICON_BUTTON, icon, iconGlyph } from '../kit.ts';
import { quickPrivateBoard } from '../reach.ts';
import { boardPalette } from '../tokens.ts';

import type { CollabColour } from '../../board/people.ts';
import type { Tool } from '../../plugins/Board/controller.ts';
import type { BoardAttributes } from '../../plugins/Board/declaration.ts';
import type { Demo } from '../../plugins/Board/demo.ts';
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

/**
 * Three people already at it when the page opens: one drags the shape and its arrow follows, one scribbles and cheers,
 * one points with the laser. Played by the canvas as it plays real people — a loop of sixteen seconds.
 */
const SANDBOX_DEMO: Demo = {
  every: 16000,
  peers: [
    {
      name: 'Ana',
      color: 'orchid',
      steps: [
        { at: 0, to: [680, 30] },
        { at: 1400, to: [492, 128] },
        { at: 1600, grab: 'hero-shape-1' },
        { at: 3400, to: [522, 92] },
        { at: 3500, drop: true },
        { at: 3700, say: 'The arrow follows ✨' },
        { at: 6400, say: '' },
        { at: 8600, to: [522, 92] },
        { at: 8800, grab: 'hero-shape-1' },
        { at: 10600, to: [492, 128] },
        { at: 10700, drop: true },
        { at: 13500, to: [680, 30] },
        { at: 16000, to: [680, 30] }
      ]
    },
    {
      name: 'Leo',
      color: 'teal',
      steps: [
        { at: 0, to: [300, 520] },
        { at: 1800, to: [270, 238] },
        { at: 1900, pen: 'violet' },
        { at: 2200, to: [300, 205] },
        { at: 2500, to: [330, 250] },
        { at: 2800, to: [360, 205] },
        { at: 3100, to: [390, 250] },
        { at: 3200, pen: '' },
        { at: 3500, react: '🎉' },
        { at: 6000, to: [150, 170] },
        { at: 6300, say: 'Love this one' },
        { at: 8800, say: '' },
        { at: 9200, react: '❤️' },
        { at: 12500, to: [300, 520] },
        { at: 16000, to: [300, 520] }
      ]
    },
    {
      name: 'Mia',
      color: 'amber',
      steps: [
        { at: 0, to: [760, 470] },
        { at: 4200, to: [640, 350] },
        { at: 4300, laser: true },
        { at: 4700, to: [520, 470] },
        { at: 5100, to: [400, 350] },
        { at: 5500, to: [520, 232] },
        { at: 5900, to: [640, 350] },
        { at: 6000, laser: false },
        { at: 6300, react: '🔥' },
        { at: 9500, to: [760, 470] },
        { at: 16000, to: [760, 470] }
      ]
    }
  ]
};

const section = styles('hero', {
  css: {
    desktop: {
      position: 'relative',
      display: 'grid',
      'grid-template-columns': 'minmax(0px, 1fr) minmax(0px, 1.15fr)',
      'align-items': 'center',
      gap: '56px',
      padding: '40px 0px 24px'
    },
    compact: { 'grid-template-columns': 'minmax(0px, 1fr)', gap: '32px', 'padding-top': '16px' }
  }
});

/**
 * The colour the hero stands in: the cursors' colours as light on the paper, wider than the page — the page clips it
 * rather than scroll sideways — and faded out at its edges, so it is a glow and not a box.
 */
const backdrop = styles('heroBackdrop', {
  position: 'absolute',
  inset: '-120px -320px -80px -320px',
  'z-index': '0',
  'pointer-events': 'none',
  'background-image': [
    'radial-gradient(34% 46% at 30% 32%, color-mix(in srgb, var(--collab-amber) 30%, transparent), transparent)',
    'radial-gradient(30% 44% at 72% 22%, color-mix(in srgb, var(--collab-orchid) 26%, transparent), transparent)',
    'radial-gradient(34% 44% at 64% 86%, color-mix(in srgb, var(--collab-teal) 22%, transparent), transparent)',
    'radial-gradient(24% 34% at 40% 88%, color-mix(in srgb, var(--collab-sky) 20%, transparent), transparent)'
  ].join(', '),
  filter: 'blur(12px)'
});

/** What stands on the backdrop, above it. */
const lifted = { position: 'relative', 'z-index': '1' } as const;

const pitch = styles('heroPitch', {
  ...lifted,
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'flex-start',
  gap: '22px'
});

/**
 * Things left lying about the hero, drifting a little: a note, a stamp, a star — the board's own things, so the page
 * looks like one before anything is drawn. Only where there is room for them; still for whoever asked for less motion
 * (every one is a `motion…` class).
 */
const LITTER = {
  position: 'absolute',
  'z-index': '2',
  'pointer-events': 'none',
  animation: 'wb-float 7s ease-in-out infinite'
} as const;

const litterNote = styles('motionHeroNote', {
  css: {
    desktop: {
      ...LITTER,
      top: '28px',
      left: '31%',
      width: '104px',
      height: '96px',
      padding: '12px',
      'font-family': 'var(--hand)',
      'font-size': '17px',
      'line-height': '1.15',
      color: 'var(--ink)',
      'background-color': 'var(--sticky-yellow)',
      'box-shadow': '0 12px 24px -12px rgba(0, 0, 0, 0.35)',
      '--tilt': '-8deg'
    },
    compact: { display: 'none' }
  }
});

const litterStamp = styles('motionHeroStamp', {
  css: {
    desktop: {
      ...LITTER,
      bottom: '56px',
      left: '-34px',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: '58px',
      height: '58px',
      'border-radius': '50%',
      'font-size': '28px',
      'background-color': 'var(--surface)',
      'box-shadow': '0 10px 24px -10px var(--shadow), 0 0 0 3px var(--collab-rose)',
      'animation-delay': '-2.5s',
      '--tilt': '10deg'
    },
    compact: { display: 'none' }
  }
});

const litterStar = styles('motionHeroStar', {
  css: {
    desktop: {
      ...LITTER,
      top: '-26px',
      left: '-22px',
      'font-size': '42px',
      color: 'var(--collab-amber)',
      'text-shadow': '0 6px 16px color-mix(in srgb, var(--collab-amber) 50%, transparent)',
      'animation-delay': '-4s',
      '--tilt': '14deg'
    },
    compact: { display: 'none' }
  }
});

const headline = styles('heroTitle', {
  css: {
    desktop: {
      margin: '0px',
      'font-family': 'var(--hand)',
      'font-size': '92px',
      'font-weight': '700',
      'line-height': '0.98',
      'letter-spacing': '-0.01em',
      color: 'var(--ink)'
    },
    mobile: { 'font-size': '56px' }
  }
});

/** A marker stroke under the word, drawn in once the page is there — `wb-marker` in `css.ts`. */
const highlight = styles('heroHighlight', {
  display: 'inline-block',
  'background-image': 'linear-gradient(transparent 64%, var(--fill-yellow) 64%)',
  'background-repeat': 'no-repeat',
  'background-size': '100% 100%',
  padding: '0px 6px',
  animation: 'wb-marker 900ms 300ms cubic-bezier(0.2, 0.7, 0.2, 1) both'
});

/** The word itself in the cursors' colours, over the marker. */
const inColour = styles('heroInColour', {
  'background-image': 'linear-gradient(100deg, var(--accent), var(--collab-orchid) 55%, var(--collab-coral))',
  'background-clip': 'text',
  color: 'transparent'
});

const lead = styles('heroLead', {
  margin: '0px',
  'max-width': '520px',
  'font-size': '19px',
  'line-height': '1.55',
  color: 'var(--muted)'
});

/**
 * The two ways to start, side by side, and under them the way in to somebody else's board — as wide as both, so the
 * three read as one block: start one, or join one.
 */
const actions = styles('heroActions', {
  css: {
    desktop: {
      display: 'inline-grid',
      'grid-template-columns': 'auto auto',
      'align-items': 'center',
      'justify-self': 'start',
      'align-self': 'flex-start',
      gap: '12px'
    },
    mobile: { display: 'grid', 'grid-template-columns': 'minmax(0px, 1fr)', 'align-self': 'stretch' }
  }
});

const joinForm = styles('joinForm', {
  css: {
    'grid-column': '1 / -1',
    display: 'flex',
    'align-items': 'center',
    gap: '8px',
    height: '56px',
    padding: '0px 6px 0px 16px',
    'border-radius': '16px',
    border: '1.5px solid color-mix(in srgb, var(--accent) 35%, var(--edge))',
    'background-color': 'var(--surface)',
    'box-shadow': '0 10px 30px -14px color-mix(in srgb, var(--accent) 55%, transparent)',
    transition: 'border-color 160ms ease, box-shadow 160ms ease'
  },
  states: {
    hover: { 'border-color': 'color-mix(in srgb, var(--accent) 60%, var(--edge))' },
    'focus-within': {
      'border-color': 'var(--accent)',
      'box-shadow':
        '0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent), 0 10px 30px -14px color-mix(in srgb, var(--accent) 55%, transparent)'
    }
  }
});

const joinMark = styles('joinMark', { 'font-size': '16px', color: 'var(--accent)', 'flex-shrink': '0' });

/** The field sits in the form's pill, which is its box: the slot draws none of its own. */
const joinBox = styles('joinBox', {
  css: {
    display: 'flex',
    'align-items': 'center',
    height: '44px',
    padding: '0px 4px',
    border: '0px',
    'background-color': 'transparent',
    'box-shadow': 'none',
    'font-size': '16px',
    'font-weight': '500'
  }
});

const joinField = styles('joinField', { flex: '1', 'min-width': '0px' });

const joinGo = styles('joinGo', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    'align-items': 'center',
    gap: '8px',
    height: '44px',
    padding: '0px 18px',
    'border-radius': '12px',
    'font-weight': '700',
    'font-size': '15px',
    color: 'var(--on-accent)',
    'background-color': 'var(--accent)',
    'flex-shrink': '0',
    transition: 'filter 140ms ease, transform 140ms ease'
  },
  states: { hover: { filter: 'brightness(1.08)' }, active: { transform: 'scale(0.96)' } }
});

const perks = styles('heroPerks', { display: 'flex', 'flex-wrap': 'wrap', gap: '8px', 'max-width': '560px' });

/** What a board has, as chips in the cursors' colours — one colour each, so the row reads as many things. */
const perkIn = (tone: CollabColour) =>
  styles(`heroPerk-${tone}`, {
    display: 'inline-flex',
    'align-items': 'center',
    gap: '7px',
    padding: '6px 12px',
    'border-radius': '999px',
    'font-size': '13px',
    'font-weight': '600',
    color: 'var(--ink)',
    'background-color': `color-mix(in srgb, var(--collab-${tone}) 13%, var(--surface))`,
    border: `1px solid color-mix(in srgb, var(--collab-${tone}) 30%, transparent)`
  });

const perkMark = (tone: CollabColour) => styles(`heroPerkMark-${tone}`, { color: `var(--collab-${tone})` });

const PERKS: readonly [string, string, CollabColour][] = [
  ['fa-solid fa-arrow-pointer', 'Live cursors', 'sky'],
  ['fa-regular fa-note-sticky', 'Sticky piles', 'amber'],
  ['fa-regular fa-image', 'Paste images', 'rose'],
  ['fa-solid fa-table-columns', 'Kanban columns', 'lime'],
  ['fa-regular fa-comment', 'Comments & chat', 'teal'],
  ['fa-solid fa-robot', 'AI agents join in', 'orchid'],
  ['fa-solid fa-lock', 'Private & temporary', 'indigo']
];

/** A soft light behind the sandbox, in the accent: where the eye goes first. */
const glow = styles('heroGlow', {
  position: 'absolute',
  inset: '-60px -40px -40px -40px',
  'z-index': '0',
  'pointer-events': 'none',
  'background-image': 'radial-gradient(closest-side, color-mix(in srgb, var(--accent) 24%, transparent), transparent)',
  'background-size': '80% 90%',
  'background-position': '80% 40%',
  'background-repeat': 'no-repeat',
  filter: 'blur(24px)'
});

const sandboxWrap = styles('sandboxWrap', { ...lifted });

const sandboxFrame = styles('sandboxFrame', {
  ...FLOAT,
  position: 'relative',
  'z-index': '1',
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
  css: {
    desktop: {
      'margin-left': 'auto',
      display: 'inline-flex',
      'align-items': 'center',
      gap: '8px',
      'font-size': '12px',
      'font-weight': '600',
      color: 'var(--muted)',
      'white-space': 'nowrap'
    },
    mobile: { display: 'none' }
  }
});

const sandboxFaces = styles('sandboxFaces', { display: 'inline-flex' });

/** The played collaborators' faces, in their colours — the ones on the canvas right beside. */
const sandboxFace = (initial: string, colour: string) =>
  text({
    content: initial,
    class: styles(`sandboxFace-${colour}`, {
      display: 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: '22px',
      height: '22px',
      'margin-left': '-5px',
      'border-radius': '50%',
      border: '2px solid var(--surface)',
      'font-size': '10px',
      'font-weight': '700',
      color: '#ffffff',
      'background-color': `var(--collab-${colour})`
    })
  });

const sandboxTool = styles('sandboxTool', {
  css: { ...ICON_BUTTON, width: '32px', height: '32px', 'font-size': '14px' },
  states: { hover: { 'background-color': 'var(--surface-2)' } },
  variants: { active: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

/** The sandbox's canvas: `boardCanvas`'s colours (in `css.ts`), a fixed height to play in. */
const sandboxCanvas = styles('sandboxCanvas', {
  css: { desktop: { position: 'relative', height: '480px' }, mobile: { height: '340px' } }
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
    class: styles('sandboxBoard', { position: 'absolute', inset: '0px', ...boardPalette }),
    boardId: 'sandbox',
    mode: 'edit',
    elements: welcome(),
    demo: SANDBOX_DEMO,
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

const sandboxCard = (): ElementSpec =>
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
          container({
            class: sandboxLabel,
            children: [
              container({
                class: sandboxFaces,
                children: SANDBOX_DEMO.peers.map(peer => sandboxFace(peer.name.slice(0, 1), peer.color))
              }),
              text({ content: 'Ana, Leo and Mia are in — draw with them' })
            ]
          })
        ]
      }),
      container({ class: sandboxCanvas, children: [sandboxBoard()] })
    ]
  });

const sandbox = (): ElementSpec =>
  container({
    class: sandboxWrap,
    children: [
      container({ class: glow, children: [] }),
      sandboxCard(),
      text({ content: '🎉', class: litterStamp }),
      text({ content: '★', class: litterStar })
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
      fontAwesome({ icon: 'fa-solid fa-link', class: joinMark }),
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
      button({
        id: 'join-go',
        subType: 'submit',
        content: '',
        class: joinGo,
        children: [text({ content: 'Join' }), fontAwesome({ icon: 'fa-solid fa-arrow-right', class: iconGlyph })]
      })
    ]
  });

export const hero = (): ElementSpec =>
  container({
    class: section,
    children: [
      container({ class: backdrop, children: [] }),
      text({ content: 'No sign-up, just draw ✨', class: litterNote }),
      container({
        class: pitch,
        children: [
          container({
            subType: 'h1',
            class: headline,
            children: [
              text({ content: 'Draw ' }),
              container({ class: highlight, children: [text({ content: 'together.', class: inColour })] })
            ]
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
              quickPrivateBoard(),
              join()
            ]
          }),
          container({
            class: perks,
            children: PERKS.map(([glyph, label, tone]) =>
              container({
                class: perkIn(tone),
                children: [container({ class: perkMark(tone), children: [icon(glyph)] }), text({ content: label })]
              })
            )
          })
        ]
      }),
      sandbox()
    ]
  });
