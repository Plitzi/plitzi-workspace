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
  whenFailed,
  whileRunning
} from '@plitzi/sdk-authoring';

import {
  APPLY_ACTION,
  CREATE_ACTION,
  LOAD_ACTION,
  OPEN_ACTION,
  RENAME_ACTION,
  UPLOAD_ACTION,
  VOTE_ACTION
} from '../actions.ts';
import { BOARD_KEY, BOARD_SHOWN, editOnly, ofBoard, readOnlyOnly, unlockScreen } from './access.ts';
import declaration from '../plugins/Board/declaration.ts';
import { deleteButton, deletePanel } from './deleteBoard.ts';
import { BOARD_ID, BOARD_PROVIDER } from './ids.ts';
import { keysHelp, shortcuts } from './keys.ts';
import { BUTTON_RESET, FLOAT, divide, icon, iconAction } from './kit.ts';
import { popoverBackdrop } from './panels.ts';
import { popovers, presence } from './people.ts';
import { readOnlyBanner } from './readOnly.ts';
import { identity } from './state.ts';
import { boardAction, stylePanel } from './stylePanel.ts';
import { selectionTools } from './selectionTools.ts';
import { timerButton, timerPanel, timerPill } from './timer.ts';
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

const PROVIDER = `apiContainer_${BOARD_PROVIDER}`;

/** The flows' name for the board being shown: the provider's answer, so it is the board that was actually loaded. */
const THIS_BOARD = `{{ ${PROVIDER}.id }}`;

/**
 * A channel's topic for the board shown — `board:<topic>`, `room:<topic>` — or none while a locked board is not yet
 * opened: a channel with no topic opens nothing.
 */
const TOPIC = (channel: 'board' | 'room'): string =>
  `{{ ${ofBoard('topic', "''")} ? '${channel}:' ~ ${ofBoard('topic', "''")} : '' }}`;

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
  css: { desktop: { width: '180px' }, mobile: { display: 'none' } }
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

const readOnlyTitle = styles('readOnlyTitle', {
  css: {
    desktop: {
      padding: '0px 10px',
      'font-weight': '600',
      'max-width': '260px',
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
      'white-space': 'nowrap'
    },
    mobile: { display: 'none' }
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
      // A read-only board is looked around together: cursors, laser and reactions, and nothing that changes it.
      bindTemplate('mode', BOARD_PROVIDER, "{{ source.readOnly ? 'read' : 'edit' }}"),
      // The board as it is shown: its own elements — or, locked, the ones opening it answered.
      bindTemplate('elements', BOARD_PROVIDER, `{{ ${ofBoard('elements', '[]')} }}`, { returns: 'value' }),
      { to: 'title', source: `${BOARD_PROVIDER}.title` },
      bindTemplate('topic', BOARD_PROVIDER, TOPIC('board')),
      bindTemplate('roomTopic', BOARD_PROVIDER, TOPIC('room')),
      bindTemplate('assetBase', `${BOARD_PROVIDER}.id`, '/board-assets/{{ source }}'),
      { to: 'voter', source: 'computed.visitor' },
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
          input: { board: THIS_BOARD, ops: '{{ commit.ops }}', key: BOARD_KEY },
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
        addNotification({
          content: '{{ failed.error ? failed.error : "That could not be saved" }}',
          appearance: 'danger',
          placement: 'bottom-center',
          autoDismissTimeout: 5000
        })
      ],
      /**
       * A picture pasted or dropped: uploaded — one at a time, in order — and only then put on the board for everyone.
       * Refused, it goes from this screen too, and the reason is said.
       */
      [
        whileRunning('queue', named('pasted', declaredTrigger(declaration, 'onImagePaste'))),
        named(
          'uploaded',
          runServerAction({
            actionId: UPLOAD_ACTION,
            input: { board: THIS_BOARD, data: '{{ pasted.data }}', key: BOARD_KEY },
            invalidateQueries: 'none'
          })
        ),
        when(
          { field: 'uploaded.status', operator: '=', value: 'completed' },
          boardAction('placeImage', { id: '{{ pasted.id }}', asset: '{{ uploaded.output.asset }}' })
        ),
        whenFailed('uploaded', boardAction('cancelImage', { id: '{{ pasted.id }}' })),
        whenFailed(
          'uploaded',
          addNotification({
            content: '{{ uploaded.error ? uploaded.error : "That picture could not be added" }}',
            appearance: 'danger',
            placement: 'bottom-center',
            autoDismissTimeout: 5000
          })
        )
      ],
      // A vote — a badge clicked, or the selection's button — kept by the server, one at a time, and announced.
      [
        whileRunning('queue', named('voted', declaredTrigger(declaration, 'onVote'))),
        runServerAction({
          actionId: VOTE_ACTION,
          input: { board: THIS_BOARD, element: '{{ voted.id }}', voter: '{{ computed.visitor }}', key: BOARD_KEY },
          invalidateQueries: 'none'
        })
      ],
      [
        named('summoned', declaredTrigger(declaration, 'onSummoned')),
        addNotification({
          content: '{{ summoned.name }} brought everyone here',
          appearance: 'info',
          placement: 'top-center',
          autoDismissTimeout: 3500
        })
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
        setState({ key: 'selectionCanStroke', type: 'boolean', value: '{{ picked.canStroke }}' }),
        setState({ key: 'selectionCanFill', type: 'boolean', value: '{{ picked.canFill }}' }),
        setState({ key: 'selectionCanWidth', type: 'boolean', value: '{{ picked.canWidth }}' }),
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
      // Back after a drop: read the board again — open it again, if it is locked — and the canvas merges what it missed.
      [
        declaredTrigger(declaration, 'onResync'),
        when({ field: `${PROVIDER}.locked`, operator: '!=', value: true }, reloadApi(BOARD_PROVIDER)),
        when(
          { field: `${PROVIDER}.locked`, operator: '=', value: true },
          named(
            'reread',
            runServerAction({
              actionId: OPEN_ACTION,
              input: { id: THIS_BOARD, key: BOARD_KEY },
              invalidateQueries: 'none'
            })
          )
        ),
        when(
          { field: 'reread.status', operator: '=', value: 'completed' },
          setState({ key: 'opened', type: 'json', value: '{{ reread.output }}' })
        )
      ]
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
            input: { board: THIS_BOARD, title: '{{ state.titleDraft }}', key: BOARD_KEY },
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
      editOnly([
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
        divide()
      ]),
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
      editOnly([title(), deleteButton()]),
      // A read-only board's name is read, not edited.
      readOnlyOnly([text({ content: '', class: readOnlyTitle, bind: { content: `${BOARD_PROVIDER}.title` } })])
    ]
  }),
  container({
    id: 'top-right',
    class: topRight,
    children: [
      editOnly([timerButton()]),
      iconAction({
        id: 'summon',
        icon: 'fa-solid fa-bullhorn',
        title: 'Bring everyone here — show them what you see',
        flow: [onClick(), boardAction('summon')]
      }),
      ...presence(),
      themeToggle({ id: 'theme', subType: 'switch', class: themeSwitch })
    ]
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
  flows: [[onPageLoad(), ...identity]],
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
          keep: 0,
          // Who this page is to the others: its name and colour, announced again whenever either changes. Its topic is
          // the board's — with, for a locked one, the secret opening it answered: before that, there is none to open.
          bind: [{ to: 'presence', source: 'computed.me' }, bindTemplate('topic', BOARD_PROVIDER, TOPIC('room'))],
          children: [
            container({
              id: 'workspace',
              class: stage,
              visible: { source: BOARD_PROVIDER, template: BOARD_SHOWN },
              flows: shortcuts,
              children: [
                canvas(),
                container({
                  id: 'chrome',
                  class: chrome,
                  children: [
                    ...header(),
                    editOnly([toolbar(), stylePanel()]),
                    readOnlyBanner(),
                    followBanner(),
                    timerPill(),
                    timerPanel(),
                    bottomTray(),
                    zoomBar(),
                    helpCorner(),
                    popoverBackdrop(),
                    ...popovers(),
                    deletePanel(),
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
          keep: 0,
          bind: [bindTemplate('topic', BOARD_PROVIDER, TOPIC('board'))],
          flows: [
            [
              named('heard', on('onMessage')),
              when({ field: 'heard.type', operator: '=', value: 'title' }, reloadApi(BOARD_PROVIDER)),
              when(
                { field: 'heard.type', operator: '=', value: 'timer' },
                setState({ key: 'timer', type: 'json', value: '{{ heard.data }}' })
              ),
              // The password changed: what was opened no longer is. Read the board again — and be asked, like anyone.
              when(
                { field: 'heard.type', operator: '=', value: 'locked' },
                setState({ key: 'opened', type: 'json', value: 'null' })
              ),
              when({ field: 'heard.type', operator: '=', value: 'locked' }, reloadApi(BOARD_PROVIDER)),
              // The board is gone: nobody stays on nothing. Everyone is told, and sent back to the boards.
              when(
                { field: 'heard.type', operator: '=', value: 'deleted' },
                addNotification({
                  content: 'This board was deleted — back to all boards',
                  appearance: 'info',
                  placement: 'top-center',
                  autoDismissTimeout: 5000
                })
              ),
              when(
                { field: 'heard.type', operator: '=', value: 'deleted' },
                navigate({ urlType: 'internal', url: '/' })
              )
            ]
          ]
        }),
        unlockScreen(),
        notFound()
      ]
    })
  ]
};
