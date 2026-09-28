import {
  addNotification,
  apiContainer,
  bindTemplate,
  button,
  channel,
  container,
  declaredTrigger,
  defineElement,
  fontAwesome,
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
  toggleState,
  variantFrom,
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
import { chatButton, chatPanel, hearChat, sayInChat } from './chat.ts';
import { COPY_DECLARATION, copyClass, copyText } from './copy.ts';
import { deleteButton, deletePanel } from './deleteBoard.ts';
import { dutyPanel } from './duty.ts';
import { framesButton, framesPanel, listViewButton, minimapButton, presentationBanner } from './frames.ts';
import { BOARD_ID, BOARD_PROVIDER } from './ids.ts';
import { agentButtonFor, agentPanel } from './invite.ts';
import { keysHelp, shortcuts } from './keys.ts';
import { BUTTON_RESET, FLOAT, ICON_BUTTON, PRESSED, divide, icon, iconAction } from './kit.ts';
import { libraryPanel } from './library.ts';
import { closePanels, popoverBackdrop } from './panels.ts';
import { popovers, presence } from './people.ts';
import { reachBadges } from './reach.ts';
import { readOnlyBanner } from './readOnly.ts';
import { searchBar, searchButton } from './search.ts';
import { selectionTools } from './selectionTools.ts';
import { SESSION, sessionBar } from './session.ts';
import { settingsButton, settingsPanel } from './settings.ts';
import { identity } from './state.ts';
import { boardAction, stylePanel } from './stylePanel.ts';
import { hearTemplates, TEMPLATES, templateSaveFlow } from './templates.ts';
import { timerButton, timerPanel, timerPill } from './timer.ts';
import { boardPalette } from './tokens.ts';
import { toolbar, toolFlyouts } from './toolbar.ts';
import { bottomTray, followBanner, reactionPicker, stampPicker } from './tray.ts';
import { ASSETS_PATH } from '../board/brand.ts';
import declaration from '../plugins/Board/declaration.ts';

import type { BoardAttributes } from '../plugins/Board/declaration.ts';
import type { ElementSpec, PageSpec, StepSpec } from '@plitzi/sdk-authoring';

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

/** A member arriving or leaving, told for a moment at the foot of the board. */
const cameOrWent = (content: string): StepSpec =>
  addNotification({ content, appearance: 'info', placement: 'bottom-center', autoDismissTimeout: 3000 });

/** The flows' name for the board being shown: the provider's answer, so it is the board that was actually loaded. */
const THIS_BOARD = `{{ ${PROVIDER}.id }}`;

/**
 * A channel's topic for the board shown — `board:<topic>`, `room:<topic>` — or none while a locked board is not yet
 * opened: a channel with no topic opens nothing.
 */
const TOPIC = (channel: 'board' | 'room'): string =>
  `{{ ${ofBoard('topic', "''")} ? '${channel}:' ~ ${ofBoard('topic', "''")} : '' }}`;

/**
 * The board's announcements. A board not opened yet — locked, its topic not given until its password is — is still
 * listened to on the open board's own topic, where its lock being removed is said: nothing else is ever published
 * there while it is locked.
 */
const FEED_TOPIC = `{{ ${ofBoard('topic', "''")} ? 'board:' ~ ${ofBoard('topic', "''")} : (source.found ? 'board:' ~ source.id : '') }}`;

/**
 * What opens a board's channel on this page: the grant the server answered with the board — `board-load`, or, for a
 * locked one, `board-open` after its password. The channels are private (`grant: true`): a topic's name is not enough.
 */
const GRANT = (channel: 'board' | 'room'): string => `{{ ${ofBoard(`grants.${channel}`, "''")} }}`;

/** The feed's: before a locked board is opened, the one `board-load` gave for its open topic, where unlocking is said. */
const FEED_GRANT = `{{ ${ofBoard('grants.board', 'source.grants.board')} }}`;

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
export const canvasClass = styles('boardCanvas', { position: 'absolute', inset: '0px', ...boardPalette });

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

/**
 * What folds away in the corner: all but the way home — the name, its settings, what the board is. Folded, the corner
 * is a small mark and the board has its top edge back; the width goes as the columns of a grid do (`1fr` → `0fr`),
 * so nothing is measured, and what folds leaves the keyboard's reach too (`visibility`, flipped at the far end).
 */
const FOLD = '320ms cubic-bezier(0.2, 0.8, 0.2, 1)';

const foldable = styles('topLeftFoldable', {
  css: {
    desktop: {
      display: 'grid',
      'grid-template-columns': '1fr',
      transition: `grid-template-columns ${FOLD}, opacity 200ms ease, visibility ${FOLD}`
    },
    mobile: { display: 'contents' }
  },
  variants: {
    folded: {
      desktop: {
        'grid-template-columns': '0fr',
        opacity: '0',
        visibility: 'hidden',
        transition: `grid-template-columns ${FOLD}, opacity 140ms ease, visibility ${FOLD}`
      },
      mobile: {}
    }
  }
});

/** The folding row itself: clipped as it narrows, with room around it for a focus ring. */
const foldableRow = styles('topLeftFoldableRow', {
  css: {
    desktop: {
      display: 'flex',
      'align-items': 'center',
      gap: '2px',
      'min-width': '0px',
      overflow: 'hidden',
      padding: '3px',
      margin: '-3px'
    },
    mobile: { display: 'contents' }
  }
});

const foldButton = styles('foldButton', {
  css: { desktop: { ...ICON_BUTTON, width: '28px', color: 'var(--muted)' }, mobile: { display: 'none' } },
  states: {
    hover: { color: 'var(--ink)', 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '1px' },
    active: PRESSED
  },
  variants: { folded: {} }
});

const foldGlyph = styles('foldGlyph', {
  css: { 'pointer-events': 'none', 'line-height': '1', transition: `transform ${FOLD}` },
  ancestors: { [foldButton.name]: { variants: { folded: { transform: 'rotate(180deg)' } } } }
});

const FOLDED = { template: "{{ source ? 'folded' : '' }}" };

/** On a phone the corner has no room for it: the share panel carries it there. */
const boardCodeChip = styles('boardCodeChip', { css: { desktop: {}, mobile: { display: 'none' } } });

/**
 * The board's code beside its name, a click from the clipboard: what a person pastes on the front page to get here,
 * or hands an agent — who joins by it as well as by the link.
 */
const boardCode = (): ElementSpec =>
  copyText({
    id: 'board-code',
    compact: true,
    text: '',
    label: 'Copy this board’s code — for an agent, or the front page’s “Paste a board link or code”',
    class: [copyClass, boardCodeChip],
    bind: { text: `${BOARD_PROVIDER}.id` },
    flows: [
      [
        declaredTrigger(COPY_DECLARATION, 'onCopied'),
        boardAction('chime', { sound: 'copy' }),
        addNotification({
          content: 'Board code copied',
          appearance: 'success',
          placement: 'bottom-center',
          autoDismissTimeout: 2000
        })
      ]
    ]
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
      bindTemplate('grant', BOARD_PROVIDER, GRANT('board')),
      bindTemplate('roomGrant', BOARD_PROVIDER, GRANT('room')),
      bindTemplate('assetBase', `${BOARD_PROVIDER}.id`, `${ASSETS_PATH}/{{ source }}`),
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
      bindTemplate('session', BOARD_PROVIDER, SESSION, { returns: 'value' }),
      bindTemplate('templates', BOARD_PROVIDER, TEMPLATES, { returns: 'value' }),
      { to: 'minimap', source: 'computed.minimap' },
      { to: 'outline', source: 'computed.listView' },
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
      templateSaveFlow,
      // Words said at the cursor with Enter are kept in the chat too: said once, read by whoever looks either way.
      [
        named('cursorSaid', declaredTrigger(declaration, 'onCursorSay')),
        ...sayInChat('{{ cursorSaid.text }}', 'cursorChat')
      ],
      // What the canvas tells the person about what just happened: a blocked card moved on, a link made or refused —
      // in the colour of what it is: a warning, news, or something done.
      [
        named('told', declaredTrigger(declaration, 'onNotice')),
        ...(['warning', 'info', 'success'] as const).map(tone =>
          when(
            { field: 'told.tone', operator: '=', value: tone },
            addNotification({
              content: '{{ told.text }}',
              appearance: tone,
              placement: 'bottom-center',
              autoDismissTimeout: 5000
            })
          )
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
        setState({ key: 'selectionIsCard', type: 'boolean', value: '{{ picked.isCard }}' }),
        setState({ key: 'selectionIsDone', type: 'boolean', value: '{{ picked.isDone }}' }),
        setState({ key: 'selectionIsLocked', type: 'boolean', value: '{{ picked.isLocked }}' }),
        setState({ key: 'selectionCanEdges', type: 'boolean', value: '{{ picked.canEdges }}' }),
        setState({ key: 'selectionCanFillStyle', type: 'boolean', value: '{{ picked.canFillStyle }}' }),
        setState({ key: 'selectionCanOpacity', type: 'boolean', value: '{{ picked.canOpacity }}' }),
        setState({ key: 'selectionIsFrame', type: 'boolean', value: '{{ picked.isFrame }}' }),
        setState({ key: 'selectionIsColumn', type: 'boolean', value: '{{ picked.isColumn }}' }),
        setState({ key: 'selectionCompletes', type: 'boolean', value: '{{ picked.completes }}' }),
        setState({ key: 'selectionIsBranch', type: 'boolean', value: '{{ picked.isBranch }}' }),
        // A frame's duty, and the draft its panel starts from: what the frame has, or a scribe to begin with.
        setState({ key: 'hasDuty', type: 'boolean', value: '{{ picked.hasDuty }}' }),
        setState({ key: 'dutyAgent', type: 'text', value: '{{ picked.dutyAgent }}' }),
        setState({ key: 'dutyPaused', type: 'boolean', value: '{{ picked.dutyPaused }}' }),
        setState({ key: 'dutyDraftRole', type: 'text', value: "{{ picked.dutyRole ? picked.dutyRole : 'scribe' }}" }),
        setState({ key: 'dutyDraft', type: 'text', value: '{{ picked.dutyInstruction }}' }),
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
      // Something carried to the board — off the library, off the pad — is under way: what is open makes way for it.
      [declaredTrigger(declaration, 'onCarry'), ...closePanels],
      // The session the board goes through, as the canvas reads it: what the bar at the top shows.
      [
        named('stepped', declaredTrigger(declaration, 'onSessionChange')),
        setState({ key: 'sessionView', type: 'json', value: '{{ stepped|json_encode }}' })
      ],
      // What the search finds, for the bar; the tags written on the board, for it to offer.
      [
        named('searched', declaredTrigger(declaration, 'onSearchChange')),
        setState({ key: 'searchCount', type: 'number', value: '{{ searched.count }}' }),
        setState({ key: 'searchIndex', type: 'number', value: '{{ searched.index }}' })
      ],
      [
        named('tagged', declaredTrigger(declaration, 'onTagsChange')),
        setState({ key: 'tags', type: 'json', value: '{{ tagged.tags|json_encode }}' })
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
      listViewButton(),
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
      container({
        class: foldable,
        bind: [variantFrom(foldable, 'computed.headerFolded', FOLDED)],
        children: [
          container({
            class: foldableRow,
            children: [
              text({ content: '', class: titleDivider }),
              editOnly([title()]),
              // A read-only board's name is read, not edited.
              readOnlyOnly([text({ content: '', class: readOnlyTitle, bind: { content: `${BOARD_PROVIDER}.title` } })]),
              boardCode(),
              editOnly([settingsButton(), deleteButton()]),
              ...reachBadges()
            ]
          })
        ]
      }),
      button({
        id: 'header-fold',
        content: '',
        title: 'Fold this bar away',
        class: foldButton,
        bind: [
          variantFrom(foldButton, 'computed.headerFolded', FOLDED),
          bindTemplate(
            'title',
            'computed.headerFolded',
            "{{ source ? 'Show the board name and settings' : 'Fold this bar away' }}"
          )
        ],
        flows: [[onClick(), ...closePanels, toggleState({ key: 'headerFolded' })]],
        children: [fontAwesome({ icon: 'fa-solid fa-angles-left', class: foldGlyph })]
      })
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
      searchButton(),
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
          // the board's, opened with the grant the server answered — for a locked one, only once it has been opened.
          bind: [
            { to: 'presence', source: 'computed.me' },
            bindTemplate('topic', BOARD_PROVIDER, TOPIC('room')),
            bindTemplate('grant', BOARD_PROVIDER, GRANT('room'))
          ],
          // Somebody coming or going is said, by the name they announced — the canvas chimes, this says who.
          flows: [
            [named('arrived', on('onJoin')), cameOrWent('{{ arrived.state.name ?? "Someone" }} joined the board')],
            [named('departed', on('onLeave')), cameOrWent('{{ departed.state.name ?? "Someone" }} left the board')]
          ],
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
                    searchBar(),
                    sessionBar(),
                    dutyPanel(),
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
          bind: [bindTemplate('topic', BOARD_PROVIDER, FEED_TOPIC), bindTemplate('grant', BOARD_PROVIDER, FEED_GRANT)],
          flows: [
            [
              named('heard', on('onMessage')),
              when({ field: 'heard.type', operator: '=', value: 'title' }, reloadApi(BOARD_PROVIDER)),
              // Made private, public, temporary: read the board again — the badges say what it is now.
              when({ field: 'heard.type', operator: '=', value: 'reach' }, reloadApi(BOARD_PROVIDER)),
              when({ field: 'heard.type', operator: '=', value: 'agents' }, reloadApi(BOARD_PROVIDER)),
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
              hearTemplates('heard'),
              when(
                { field: 'heard.type', operator: '=', value: 'timer' },
                setState({ key: 'timer', type: 'json', value: '{{ heard.data }}' })
              ),
              // A session started, moved on or over — the canvas turns notes over or back, the bar follows.
              when(
                { field: 'heard.type', operator: '=', value: 'session' },
                setState({ key: 'sessionHeard', type: 'json', value: '{{ heard.data }}' })
              ),
              when(
                { field: 'heard.type', operator: '=', value: 'session' },
                boardAction('chime', { sound: "{{ heard.data.session ? 'timerStart' : 'timerStop' }}" })
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
