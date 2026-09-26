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
  REPLY_ACTION,
  UPLOAD_ACTION,
  VOTE_ACTION
} from '../actions.ts';
import {
  BOARD_KEY,
  BOARD_PASS,
  BOARD_SHOWN,
  CAN_EDIT,
  editOnly,
  keepOwned,
  ofBoard,
  readOnlyOnly,
  unlockScreen
} from './access.ts';
import { chatButton, chatPanel, hearChat } from './chat.ts';
import { deleteButton, deletePanel } from './deleteBoard.ts';
import { framesButton, framesPanel, minimapButton, presentationBanner } from './frames.ts';
import { BOARD_ID, BOARD_PROVIDER } from './ids.ts';
import { agentButtonFor, agentPanel } from './invite.ts';
import { keysHelp, shortcuts } from './keys.ts';
import { BUTTON_RESET, FLOAT, divide, icon, iconAction } from './kit.ts';
import { libraryPanel } from './library.ts';
import { popoverBackdrop } from './panels.ts';
import { popovers, presence } from './people.ts';
import { reachBadges } from './reach.ts';
import { readOnlyBanner } from './readOnly.ts';
import { selectionTools } from './selectionTools.ts';
import { settingsButton, settingsPanel } from './settings.ts';
import { identity } from './state.ts';
import { boardAction, stylePanel } from './stylePanel.ts';
import { timerButton, timerPanel, timerPill } from './timer.ts';
import { toolbar, toolFlyouts } from './toolbar.ts';
import { bottomTray, followBanner, reactionPicker, stampPicker } from './tray.ts';
import declaration from '../plugins/Board/declaration.ts';

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

/**
 * The board's announcements. A board not opened yet — locked, its topic a secret — is still listened to on the open
 * board's own topic, where its lock being removed is said: nothing else is ever published there while it is locked.
 */
const FEED_TOPIC = `{{ ${ofBoard('topic', "''")} ? 'board:' ~ ${ofBoard('topic', "''")} : (source.found ? 'board:' ~ source.id : '') }}`;

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

/**
 * Two kinds of thing in one bar, spaced as each reads: the icon buttons side by side like every other bar's — their
 * boxes are their space — then, past a divider, the people and Share, solid shapes that need room of their own.
 */
const topRight = corner('topRight', { top: '14px', right: '14px', gap: '2px' }, { top: '10px', right: '10px' });

const bottomLeft = corner('bottomLeft', { bottom: '14px', left: '14px' }, { display: 'none' });

/**
 * What a phone does without: an image file and a keyboard's shortcuts are a desktop's, and the corner has room for
 * the people, the chat and Share before it has room for the rest.
 */
const desktopOnly = styles('desktopOnly', { css: { desktop: { display: 'contents' }, mobile: { display: 'none' } } });

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

/** What everyone on a board is told when its creator makes it read-only, or opens it again — the creator included. */
const READ_ONLY_NOTICE = [
  'heard.data.readOnly',
  "? (state.owned and state.owned[heard.data.id] ? '👁 Read-only for everyone else — only you can change it'",
  ": '👁 The board is read-only now — look around, point and react')",
  ": '✏️ Everyone can draw on this board again'"
].join(' ');

/** Starting a board is asking the server for one, then going to it: the id is the server's to make up. */
export const newBoardFlow = [
  onClick(),
  named(
    'created',
    runServerAction({
      actionId: CREATE_ACTION,
      input: { title: '' },
      invalidateQueries: 'none'
    })
  ),
  keepOwned('created'),
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
      bindTemplate('mode', BOARD_PROVIDER, `{{ ${CAN_EDIT} ? 'edit' : 'read' }}`),
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
      { to: 'dash', source: 'computed.dash' },
      { to: 'sloppiness', source: 'computed.sloppiness' },
      { to: 'brush', source: 'computed.brush' },
      { to: 'edges', source: 'computed.edges' },
      { to: 'fillStyle', source: 'computed.fillStyle' },
      { to: 'opacity', source: 'computed.opacity' },
      { to: 'author', source: 'computed.name' },
      { to: 'minimap', source: 'computed.minimap' },
      { to: 'authors', source: 'computed.showAuthors' },
      { to: 'sounds', source: 'computed.sounds' },
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
          input: { board: THIS_BOARD, ops: '{{ commit.ops }}', ...BOARD_PASS },
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
            input: { board: THIS_BOARD, data: '{{ pasted.data }}', ...BOARD_PASS },
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
          input: { board: THIS_BOARD, element: '{{ voted.id }}', voter: '{{ computed.visitor }}', ...BOARD_PASS },
          invalidateQueries: 'none'
        })
      ],
      // An answer in a comment's thread: kept on the server, which announces the comment with it to everyone.
      [
        whileRunning('queue', named('replied', declaredTrigger(declaration, 'onReply'))),
        named(
          'answered',
          runServerAction({
            actionId: REPLY_ACTION,
            input: {
              board: THIS_BOARD,
              ...BOARD_PASS,
              element: '{{ replied.id }}',
              author: '{{ computed.name }}',
              text: '{{ replied.text }}'
            },
            invalidateQueries: 'none'
          })
        ),
        whenFailed(
          'answered',
          addNotification({
            content: '{{ answered.error ? answered.error : "That answer could not be kept" }}',
            appearance: 'danger',
            placement: 'bottom-center',
            autoDismissTimeout: 5000
          })
        )
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
        setState({ key: 'selectionCanDash', type: 'boolean', value: '{{ picked.canDash }}' }),
        setState({ key: 'selectionCanSloppiness', type: 'boolean', value: '{{ picked.canSloppiness }}' }),
        setState({ key: 'selectionCanBrush', type: 'boolean', value: '{{ picked.canBrush }}' }),
        setState({ key: 'selectionIsTask', type: 'boolean', value: '{{ picked.isTask }}' }),
        setState({ key: 'selectionIsDone', type: 'boolean', value: '{{ picked.isDone }}' }),
        setState({ key: 'selectionIsLocked', type: 'boolean', value: '{{ picked.isLocked }}' }),
        setState({ key: 'selectionCanEdges', type: 'boolean', value: '{{ picked.canEdges }}' }),
        setState({ key: 'selectionCanFillStyle', type: 'boolean', value: '{{ picked.canFillStyle }}' }),
        setState({ key: 'selectionCanOpacity', type: 'boolean', value: '{{ picked.canOpacity }}' }),
        setState({ key: 'selectionIsFrame', type: 'boolean', value: '{{ picked.isFrame }}' }),
        setState({ key: 'selectionIsColumn', type: 'boolean', value: '{{ picked.isColumn }}' }),
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
        ),
        ...(['dash', 'sloppiness', 'brush', 'edges', 'fillStyle'] as const).map(field =>
          when(
            [
              { field: 'picked.count', operator: '>', value: 0 },
              { field: `picked.${field}`, operator: '!=', value: '' }
            ],
            setState({ key: field, type: 'text', value: `{{ picked.${field} }}` })
          )
        ),
        when(
          [
            { field: 'picked.count', operator: '>', value: 0 },
            { field: 'picked.opacity', operator: '!=', value: '' }
          ],
          setState({ key: 'opacity', type: 'number', value: '{{ picked.opacity }}' })
        )
      ],
      // The board's frames, listed for the frames panel; a presentation, for the banner that says where it is.
      // What undo and redo are enabled by: nothing to undo — a board just opened — is nothing to press.
      [
        named('history', declaredTrigger(declaration, 'onHistoryChange')),
        setState({ key: 'canUndo', type: 'boolean', value: '{{ history.canUndo }}' }),
        setState({ key: 'canRedo', type: 'boolean', value: '{{ history.canRedo }}' })
      ],
      [
        named('framed', declaredTrigger(declaration, 'onFramesChange')),
        setState({ key: 'frames', type: 'json', value: '{{ framed.frames|json_encode }}' })
      ],
      [
        named('presented', declaredTrigger(declaration, 'onPresentationChange')),
        setState({
          key: 'presentation',
          type: 'json',
          value:
            '{ "presenter": {{ presented.presenter|json_encode }}, "position": {{ presented.position|json_encode }}, "total": {{ presented.total|json_encode }}, "title": {{ presented.title|json_encode }}, "mine": {{ presented.mine|json_encode }} }'
        })
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
            input: { board: THIS_BOARD, title: '{{ state.titleDraft }}', ...BOARD_PASS },
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
          bind: [{ to: 'disabled', source: 'computed.nothingToUndo' }],
          flow: [onClick(), boardAction('undo')]
        }),
        iconAction({
          id: 'redo',
          icon: 'fa-solid fa-rotate-right',
          title: 'Redo — ⌘⇧Z',
          bind: [{ to: 'disabled', source: 'computed.nothingToRedo' }],
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
        title: 'Zoom to fit — ⇧F',
        flow: [onClick(), boardAction('zoomToFit')]
      }),
      divide(),
      framesButton(),
      minimapButton(),
      iconAction({
        id: 'fullscreen',
        icon: 'fa-solid fa-maximize',
        title: 'Full screen — Esc leaves it',
        flow: [onClick(), boardAction('toggleFullscreen')]
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
        children: [icon('fa-solid fa-chevron-left'), text({ content: 'Pizarra', class: desktopOnly })]
      }),
      text({ content: '', class: titleDivider }),
      editOnly([title(), settingsButton(), deleteButton()]),
      ...reachBadges(),
      // A read-only board's name is read, not edited.
      readOnlyOnly([text({ content: '', class: readOnlyTitle, bind: { content: `${BOARD_PROVIDER}.title` } })])
    ]
  }),
  container({
    id: 'top-right',
    class: topRight,
    children: [
      container({
        class: desktopOnly,
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
      }),
      editOnly([timerButton()]),
      chatButton(),
      container({
        class: desktopOnly,
        children: [
          iconAction({
            id: 'summon',
            icon: 'fa-solid fa-bullhorn',
            title: 'Bring everyone here — show them what you see',
            // The others are moved, and told who moved them; whoever pressed it sees nothing move, so they are told too.
            flow: [
              onClick(),
              boardAction('summon'),
              addNotification({
                content: 'Everyone on the board now sees what you see',
                appearance: 'success',
                placement: 'top-center',
                autoDismissTimeout: 3000
              })
            ]
          })
        ]
      }),
      agentButtonFor(),
      divide(),
      presence(),
      themeToggle({ id: 'theme', subType: 'switch', class: themeSwitch })
    ]
  })
];

const notFound = (): ElementSpec =>
  container({
    id: 'board-missing',
    class: lost,
    // Only for a board asked for and not there: leaving for the front page reads the board again with no id, and a
    // page on its way out must not say the board is gone.
    visible: { source: BOARD_PROVIDER, template: '{{ source.id and not source.found }}' },
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
                    editOnly([toolbar(), stylePanel(), ...toolFlyouts(), libraryPanel()]),
                    readOnlyBanner(),
                    followBanner(),
                    presentationBanner(),
                    timerPill(),
                    timerPanel(),
                    bottomTray(),
                    zoomBar(),
                    popoverBackdrop(),
                    reactionPicker(),
                    editOnly([stampPicker()]),
                    framesPanel(),
                    chatPanel(),
                    agentPanel(),
                    ...popovers(),
                    deletePanel(),
                    settingsPanel(),
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
          bind: [bindTemplate('topic', BOARD_PROVIDER, FEED_TOPIC)],
          flows: [
            [
              named('heard', on('onMessage')),
              when({ field: 'heard.type', operator: '=', value: 'title' }, reloadApi(BOARD_PROVIDER)),
              // Made private, public, temporary: read the board again — the badges say what it is now.
              when({ field: 'heard.type', operator: '=', value: 'reach' }, reloadApi(BOARD_PROVIDER)),
              // Made read-only by whoever made it, or opened again: read it again — the canvas and the tools follow.
              when({ field: 'heard.type', operator: '=', value: 'readOnly' }, reloadApi(BOARD_PROVIDER)),
              when({ field: 'heard.type', operator: '=', value: 'readOnly' }, boardAction('chime', { sound: 'lock' })),
              when(
                { field: 'heard.type', operator: '=', value: 'readOnly' },
                addNotification({
                  content: `{{ ${READ_ONLY_NOTICE} }}`,
                  appearance: 'info',
                  placement: 'top-center',
                  autoDismissTimeout: 5000
                })
              ),
              ...hearChat('heard').map(step => when({ field: 'heard.type', operator: '=', value: 'chat' }, step)),
              when(
                { field: 'heard.type', operator: '=', value: 'timer' },
                setState({ key: 'timer', type: 'json', value: '{{ heard.data }}' })
              ),
              // A timer started — for everyone on the board, whoever started it.
              when(
                { field: 'heard.type', operator: '=', value: 'timer' },
                boardAction('chime', { sound: "{{ heard.data.timer ? 'timerStart' : 'timerStop' }}" })
              ),
              /**
               * The password changed. The page that changed it already holds the new key and topic, and goes on as it
               * is — dropping what it opened would flash the lock screen at the very person who set it. Everyone else
               * reads the board again; locked, what they opened no longer is, and they are asked like anyone. A
               * password REMOVED leaves nothing to ask: they read the board again and stay on it.
               */
              when(
                { field: 'heard.type', operator: '=', value: 'locked' },
                setState({ key: 'lockedHere', type: 'boolean', value: '{{ heard.data.by == computed.tab }}' })
              ),
              when(
                [
                  { field: 'heard.type', operator: '=', value: 'locked' },
                  { field: 'state.lockedHere', operator: '=', value: false },
                  { field: 'heard.data.locked', operator: '=', value: true }
                ],
                setState({ key: 'opened', type: 'json', value: 'null' })
              ),
              when(
                [
                  { field: 'heard.type', operator: '=', value: 'locked' },
                  { field: 'state.lockedHere', operator: '=', value: false }
                ],
                reloadApi(BOARD_PROVIDER)
              ),
              when({ field: 'heard.type', operator: '=', value: 'locked' }, boardAction('chime', { sound: 'lock' })),
              when({ field: 'heard.type', operator: '=', value: 'deleted' }, boardAction('chime', { sound: 'remove' })),
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
