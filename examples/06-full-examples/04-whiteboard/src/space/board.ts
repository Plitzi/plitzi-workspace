import {
  addNotification,
  apiContainer,
  bindTemplate,
  button,
  channel,
  container,
  declaredTrigger,
  defineElement,
  formControl,
  link,
  named,
  navigate,
  on,
  onClick,
  onFlowError,
  onPageLoad,
  reloadApi,
  runServerAction,
  setState,
  styles,
  text,
  themeToggle,
  when,
  whileRunning
} from '@plitzi/sdk-authoring';

import { APPLY_ACTION, CREATE_ACTION, LOAD_ACTION, RENAME_ACTION } from '../actions.ts';
import declaration from '../plugins/Board/declaration.ts';
import { BOARD_ID, BOARD_PROVIDER } from './ids.ts';
import { keysHelp, shortcuts } from './keys.ts';
import { BUTTON_RESET, FLOAT, divide, icon, iconAction } from './kit.ts';
import { popovers, presence } from './people.ts';
import { RANDOM_COLOUR, RANDOM_NAME } from './state.ts';
import { boardAction, stylePanel } from './stylePanel.ts';
import { selectionTools } from './selectionTools.ts';
import { toolbar } from './toolbar.ts';
import { bottomTray, followBanner } from './tray.ts';

import type { BoardAttributes } from '../plugins/Board/declaration.ts';
import type { ElementSpec, PageSpec } from '@plitzi/sdk-authoring';

/**
 * One board: `/b/{id}`.
 *
 * Read on the server into the first paint (`board-load`), so a board arrives drawn and somebody arriving late starts
 * from everything saved. Around the canvas, two channels: `room`, where this page announces who it is and the canvas
 * sends its cursor, and `feed`, where the server says what it saved. Everything else on the screen — the toolbar,
 * the palette, the avatars, the keyboard — is authored here and talks to the canvas through its actions.
 */

const boardCanvas = defineElement<BoardAttributes>(declaration);

export const BOARD_DECLARATION = declaration;

/** The flows' name for the board being shown: the provider's answer, so it is the board that was actually loaded. */
const THIS_BOARD = `{{ apiContainer_${BOARD_PROVIDER}.id }}`;

export const screen = styles('screen', {
  position: 'relative',
  width: '100%',
  height: '100dvh',
  overflow: 'hidden',
  'background-color': 'var(--paper)',
  color: 'var(--ink)',
  'font-family': 'var(--ui)',
  'line-height': '1.4'
});

const stage = styles('stage', { position: 'absolute', inset: '0px' });

/** The canvas's one class — and, in `css.ts`, where its `--board-*` colours are pointed at the space's tokens. */
export const canvasClass = styles('boardCanvas', { position: 'absolute', inset: '0px' });

/**
 * The chrome sits over the canvas and lets the pointer through everywhere it is not: a full-bleed layer that
 * swallowed clicks would make the board — the thing people came to draw on — unreachable.
 */
const chrome = styles('chrome', { position: 'absolute', inset: '0px', 'z-index': '2', 'pointer-events': 'none' });

const corner = (name: string, place: Record<string, string>, mobile: Record<string, string> = {}) =>
  styles(name, {
    css: {
      desktop: {
        ...FLOAT,
        position: 'absolute',
        ...place,
        'z-index': '3',
        display: 'flex',
        'align-items': 'center',
        gap: '2px',
        padding: '5px'
      },
      mobile
    }
  });

const topLeft = corner(
  'topLeft',
  { top: '14px', left: '14px' },
  { top: '10px', left: '10px', 'max-width': 'calc(100vw - 150px)' }
);

const topRight = corner(
  'topRight',
  { top: '14px', right: '14px', gap: '8px', 'padding-right': '8px' },
  { top: '10px', right: '10px' }
);

const bottomLeft = corner('bottomLeft', { bottom: '14px', left: '14px' }, { display: 'none' });

const bottomRight = corner('bottomRight', { bottom: '14px', right: '14px' }, { display: 'none' });

const homeLink = styles('homeLink', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    'align-items': 'center',
    gap: '8px',
    height: '36px',
    padding: '0px 10px',
    'border-radius': '8px',
    color: 'var(--ink)',
    'text-decoration': 'none',
    'font-family': 'var(--hand)',
    'font-size': '20px',
    'font-weight': '700'
  },
  states: { hover: { 'background-color': 'var(--surface-2)' } }
});

const titleDivider = styles('titleDivider', {
  css: {
    desktop: { width: '1px', height: '22px', margin: '0px 4px', 'background-color': 'var(--edge)' },
    mobile: { display: 'none' }
  }
});

/** On a phone the corner is the way home and nothing else: the people and Share need the width more. */
const titleField = styles('titleField', {
  css: { desktop: { width: '220px' }, mobile: { display: 'none' } }
});

/** The title reads as the board's name until it is pointed at: a box only on hover, and in the accent while typed in. */
const titleInput = styles('titleInput', {
  css: {
    display: 'flex',
    'align-items': 'center',
    height: '34px',
    padding: '0px 10px',
    border: '1px solid transparent',
    'border-radius': '8px',
    'font-weight': '600'
  },
  states: {
    hover: { 'background-color': 'var(--surface-2)' },
    'focus-within': { 'border-color': 'var(--accent)', 'background-color': 'var(--surface)' }
  }
});

const zoomLabel = styles('zoomLabel', {
  css: {
    ...BUTTON_RESET,
    'min-width': '52px',
    height: '36px',
    'border-radius': '8px',
    'font-size': '12px',
    'font-weight': '600',
    'font-variant-numeric': 'tabular-nums',
    color: 'var(--ink)'
  },
  states: { hover: { 'background-color': 'var(--surface-2)' } }
});

const themeSwitch = styles('themeSwitch', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    width: '36px',
    height: '36px',
    'align-items': 'center',
    'justify-content': 'center',
    'border-radius': '8px'
  },
  states: { hover: { 'background-color': 'var(--surface-2)' } }
});

const lost = styles('lost', {
  position: 'absolute',
  inset: '0px',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  'justify-content': 'center',
  gap: '14px',
  padding: '24px',
  'text-align': 'center'
});

const lostTitle = styles('lostTitle', { 'font-family': 'var(--hand)', 'font-size': '40px', 'font-weight': '700' });

const lostNote = styles('lostNote', { color: 'var(--muted)', 'max-width': '420px' });

export const primaryButton = styles('primaryButton', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    'align-items': 'center',
    gap: '8px',
    height: '42px',
    padding: '0px 18px',
    'border-radius': '10px',
    'font-weight': '600',
    'font-size': '14px',
    'background-color': 'var(--accent)',
    color: 'var(--on-accent)',
    'box-shadow': '0 6px 18px -8px var(--accent)'
  },
  states: {
    hover: { filter: 'brightness(1.08)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '3px' }
  }
});

/** Starting a board is asking the server for one, then going to it: the id is the server's to make up. */
export const newBoardFlow = [
  onClick(),
  named('created', runServerAction({ actionId: CREATE_ACTION, input: { title: '' }, invalidateQueries: 'none' })),
  navigate({ urlType: 'internal', url: '/b/{{ created.output.id }}' })
];

const canvas = (): ElementSpec =>
  boardCanvas({
    id: BOARD_ID,
    // A canvas needs a document: nothing the server could draw here would be worth sending.
    runtime: 'client',
    class: canvasClass,
    mode: 'edit',
    bind: [
      { to: 'boardId', source: `${BOARD_PROVIDER}.id` },
      { to: 'elements', source: `${BOARD_PROVIDER}.elements` },
      { to: 'title', source: `${BOARD_PROVIDER}.title` },
      bindTemplate('topic', `${BOARD_PROVIDER}.id`, 'board:{{ source }}'),
      bindTemplate('roomTopic', `${BOARD_PROVIDER}.id`, 'room:{{ source }}'),
      { to: 'tool', source: 'computed.tool' },
      { to: 'stroke', source: 'computed.stroke' },
      { to: 'fill', source: 'computed.fill' },
      { to: 'strokeWidth', source: 'computed.strokeWidth' },
      { to: 'scheme', source: 'theme.resolved' }
    ],
    flows: [
      /**
       * Every change anyone makes here goes to the server, in order: queued, so a quick move-then-delete is kept as a
       * move and then a delete. What the server keeps comes back on the board's channel, to everyone at once.
       */
      [
        whileRunning('queue', named('commit', declaredTrigger(declaration, 'onCommit'))),
        runServerAction({
          actionId: APPLY_ACTION,
          input: { board: THIS_BOARD, ops: '{{ commit.ops }}' },
          // The answer is the channel's to deliver; nothing the page asked for changed.
          invalidateQueries: 'none'
        })
      ],
      /**
       * The server refused a commit — too many at once, a board that filled up, one that was removed. What it refused
       * never reached anybody else, so it is taken off this screen too, and the person is told why.
       */
      [
        named('failed', onFlowError()),
        when({ field: 'failed.actionId', operator: '=', value: APPLY_ACTION }, boardAction('rollback')),
        when(
          { field: 'failed.actionId', operator: '=', value: APPLY_ACTION },
          addNotification({
            content: '{{ failed.error ? failed.error : "That change could not be saved" }}',
            appearance: 'danger',
            placement: 'bottom-center',
            autoDismissTimeout: 5000
          })
        )
      ],
      [
        named('switched', declaredTrigger(declaration, 'onToolChange')),
        setState({ key: 'tool', type: 'text', value: '{{ switched.tool }}' })
      ],
      /** The palette follows the selection: it shows what is selected is drawn with, where the selection agrees. */
      [
        named('picked', declaredTrigger(declaration, 'onSelectionChange')),
        setState({ key: 'selectionCount', type: 'number', value: '{{ picked.count }}' }),
        setState({ key: 'selectionGrouped', type: 'boolean', value: '{{ picked.grouped }}' }),
        setState({ key: 'selectionOneGroup', type: 'boolean', value: '{{ picked.oneGroup }}' }),
        when(
          { field: 'picked.stroke', operator: '!=', value: '' },
          setState({ key: 'stroke', type: 'text', value: '{{ picked.stroke }}' })
        ),
        when(
          { field: 'picked.fill', operator: '!=', value: '' },
          setState({ key: 'fill', type: 'text', value: '{{ picked.fill }}' })
        ),
        when(
          { field: 'picked.strokeWidth', operator: '!=', value: '' },
          setState({ key: 'strokeWidth', type: 'number', value: '{{ picked.strokeWidth }}' })
        )
      ],
      // Following somebody is the canvas's; the banner that says so is the page's.
      [
        named('followed', declaredTrigger(declaration, 'onFollowChange')),
        setState({ key: 'following', type: 'text', value: '{{ followed.name }}' })
      ],
      [
        named('viewed', declaredTrigger(declaration, 'onViewChange')),
        setState({ key: 'zoom', type: 'number', value: '{{ viewed.zoom }}' })
      ],
      // Back after a drop: read the board again, and the canvas merges whatever it missed.
      [declaredTrigger(declaration, 'onResync'), reloadApi(BOARD_PROVIDER)]
    ],
    // The selection's tools: the canvas places them beside whatever is selected.
    children: [selectionTools()]
  });

const title = (): ElementSpec =>
  formControl({
    id: 'board-title',
    name: 'title',
    label: '',
    placeholder: 'Untitled board',
    required: false,
    autoComplete: false,
    class: titleField,
    slots: { input: titleInput },
    bind: { defaultValue: `${BOARD_PROVIDER}.title` },
    flows: [
      [named('typed', on('onChange')), setState({ key: 'titleDraft', type: 'text', value: '{{ typed.value }}' })],
      /**
       * Kept when the field is left, and only if it changed: the server renames it and tells the board's channel, and
       * every page on the board reads the board again — the new name included.
       */
      [
        on('onBlur'),
        when(
          [
            { field: 'state.titleDraft', operator: '!=', value: '' },
            { field: 'state.titleDraft', operator: '!=', value: `${BOARD_PROVIDER}.title`, isBinding: true }
          ],
          runServerAction({
            actionId: RENAME_ACTION,
            input: { board: THIS_BOARD, title: '{{ state.titleDraft }}' },
            invalidateQueries: 'none'
          })
        )
      ]
    ]
  });

const zoomBar = (): ElementSpec =>
  container({
    id: 'zoom-bar',
    class: bottomLeft,
    children: [
      iconAction({
        id: 'undo',
        icon: 'fa-solid fa-rotate-left',
        title: 'Undo — ⌘Z',
        flow: [onClick(), boardAction('undo')]
      }),
      iconAction({
        id: 'redo',
        icon: 'fa-solid fa-rotate-right',
        title: 'Redo — ⌘⇧Z',
        flow: [onClick(), boardAction('redo')]
      }),
      divide(),
      iconAction({
        id: 'zoom-out',
        icon: 'fa-solid fa-minus',
        title: 'Zoom out — −',
        flow: [onClick(), boardAction('zoomOut')]
      }),
      button({
        id: 'zoom-reset',
        content: '100%',
        title: 'Zoom to 100% — ⌘0',
        class: zoomLabel,
        bind: [bindTemplate('content', 'computed.zoom', '{{ source }}%')],
        flows: [[onClick(), boardAction('zoomReset')]]
      }),
      iconAction({
        id: 'zoom-in',
        icon: 'fa-solid fa-plus',
        title: 'Zoom in — +',
        flow: [onClick(), boardAction('zoomIn')]
      }),
      iconAction({
        id: 'zoom-fit',
        icon: 'fa-solid fa-expand',
        title: 'Zoom to fit — F',
        flow: [onClick(), boardAction('zoomToFit')]
      })
    ]
  });

const helpCorner = (): ElementSpec =>
  container({
    id: 'help-corner',
    class: bottomRight,
    children: [
      iconAction({
        id: 'export',
        icon: 'fa-solid fa-download',
        title: 'Export as PNG — ⌘⇧E',
        flow: [onClick(), boardAction('exportPng')]
      }),
      iconAction({
        id: 'keys-open',
        icon: 'fa-regular fa-keyboard',
        title: 'Keyboard shortcuts — ?',
        flow: [onClick(), setState({ key: 'keysOpen', type: 'boolean', value: true })]
      })
    ]
  });

const header = (): ElementSpec[] => [
  container({
    id: 'top-left',
    class: topLeft,
    children: [
      link({
        href: '/',
        mode: 'internal',
        class: homeLink,
        label: 'All boards',
        children: [icon('fa-solid fa-chevron-left'), text({ content: 'Pizarra' })]
      }),
      text({ content: '', class: titleDivider }),
      title()
    ]
  }),
  container({
    id: 'top-right',
    class: topRight,
    children: [...presence(), themeToggle({ id: 'theme', subType: 'switch', class: themeSwitch })]
  })
];

const notFound = (): ElementSpec =>
  container({
    id: 'board-missing',
    class: lost,
    visible: { source: `${BOARD_PROVIDER}.found`, template: "{{ source ? 'false' : 'true' }}" },
    children: [
      text({ content: 'Nothing on this board', class: lostTitle }),
      text({
        content:
          'This board does not exist — or no longer does: they live in the server’s memory, and a restart clears them.',
        class: lostNote
      }),
      button({ id: 'lost-new', content: 'Start a new board', class: primaryButton, flows: [newBoardFlow] }),
      link({ href: '/', mode: 'internal', class: homeLink, children: [text({ content: 'See all boards' })] })
    ]
  });

export const boardPage: PageSpec = {
  name: 'Board',
  slug: 'b/{{id}}',
  seoTitle: 'Pizarra — a board',
  seoDescription: 'A whiteboard anyone with the link can draw on, together, live.',
  class: screen,
  /** Somebody new gets a name and a colour, at random; after that they are theirs, and kept. */
  flows: [
    [
      onPageLoad(),
      when(
        { field: 'computed.hasName', operator: '=', value: false },
        setState({ key: 'name', type: 'text', value: RANDOM_NAME })
      ),
      when(
        { field: 'computed.hasColour', operator: '=', value: false },
        setState({ key: 'color', type: 'text', value: RANDOM_COLOUR })
      )
    ]
  ],
  body: [
    apiContainer({
      id: BOARD_PROVIDER,
      subType: 'div',
      class: stage,
      runtime: 'server',
      action: LOAD_ACTION,
      // Keep drawing while a re-read lands: without it the canvas would be torn down and rebuilt on every resync.
      renderWhileLoading: true,
      children: [
        channel({
          id: 'room',
          topic: 'room:{{ id }}',
          keep: 0,
          // Who this page is to the others: its name and colour, announced again whenever either changes.
          bind: { presence: 'computed.me' },
          children: [
            container({
              id: 'workspace',
              class: stage,
              visible: `${BOARD_PROVIDER}.found`,
              flows: shortcuts,
              children: [
                canvas(),
                container({
                  id: 'chrome',
                  class: chrome,
                  children: [
                    ...header(),
                    toolbar(),
                    followBanner(),
                    stylePanel(),
                    bottomTray(),
                    zoomBar(),
                    helpCorner(),
                    ...popovers(),
                    ...keysHelp()
                  ]
                })
              ]
            })
          ]
        }),
        /**
         * The server's own announcements, read by a flow: the canvas takes the elements itself, and a rename is the
         * page's business — it reads the board again, and the title arrives with everything else.
         */
        channel({
          id: 'feed',
          topic: 'board:{{ id }}',
          keep: 0,
          flows: [
            [
              named('heard', on('onMessage')),
              when({ field: 'heard.type', operator: '=', value: 'title' }, reloadApi(BOARD_PROVIDER))
            ]
          ]
        }),
        notFound()
      ]
    })
  ]
};
