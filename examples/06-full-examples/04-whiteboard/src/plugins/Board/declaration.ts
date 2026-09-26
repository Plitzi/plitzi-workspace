import type { BoardProps } from './Board';
import type { PluginDeclaration } from '@plitzi/plitzi-sdk';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type BoardAttributes = Omit<BoardProps, 'className' | 'children'>;

const callback = (action: string, title: string) => ({ action, title, type: 'callback', params: {} }) as const;

/**
 * The canvas, as data: its events, the actions it answers to, and its defaults.
 *
 * Imported by the component, which registers exactly these, and by `src/space`, which authors the element from the
 * same object. No React in here: the space is authored in Node.
 *
 * The canvas decides nothing about the board. It draws, it takes a pointer, and it SAYS what happened — a commit, a
 * tool it switched to, a selection — while the flows around it decide what that means: `onCommit` is sent to a server
 * action, the tool is the page's state, the palette follows the selection. That is why the toolbar, the palette and
 * the keyboard are authored in the space and the canvas holds none of them.
 */
const declaration = {
  type: 'board',
  triggers: {
    /** Elements changed by this person, ready to keep: each one whole, its version already raised. */
    onCommit: { action: 'onCommit', title: 'On Commit', type: 'trigger', params: {}, preview: { ops: '', count: '' } },
    /** The canvas moved to another tool by itself — back to select after a shape, to text after a sticky. */
    onToolChange: {
      action: 'onToolChange',
      title: 'On Tool Change',
      type: 'trigger',
      params: {},
      preview: { tool: '' }
    },
    /**
     * What is selected now, with the style it shares (`''` where the selection disagrees) and what it can be restyled
     * with at all — `canStroke`, `canFill`, `canWidth`: a note has no outline, a picture nothing.
     */
    onSelectionChange: {
      action: 'onSelectionChange',
      title: 'On Selection Change',
      type: 'trigger',
      params: {},
      preview: {
        count: '',
        grouped: '',
        oneGroup: '',
        stroke: '',
        fill: '',
        strokeWidth: '',
        dash: '',
        sloppiness: '',
        brush: '',
        edges: '',
        fillStyle: '',
        opacity: '',
        canStroke: '',
        canFill: '',
        canWidth: '',
        canDash: '',
        canSloppiness: '',
        canBrush: '',
        canEdges: '',
        canFillStyle: '',
        canOpacity: '',
        isFrame: '',
        isColumn: '',
        isTask: '',
        isDone: ''
      }
    },
    onViewChange: {
      action: 'onViewChange',
      title: 'On View Change',
      type: 'trigger',
      params: {},
      preview: { zoom: '' }
    },
    /**
     * The board's channel came back after a drop: what was said meanwhile was missed, and the page should read the
     * board again. The canvas merges whatever it is given — it only knows it may have missed something.
     */
    onResync: { action: 'onResync', title: 'On Resync', type: 'trigger', params: {}, preview: {} },
    /** A picture pasted or dropped, to upload: `id` is the element waiting for it, `data` the picture itself. */
    onImagePaste: {
      action: 'onImagePaste',
      title: 'On Image Paste',
      type: 'trigger',
      params: {},
      preview: { id: '', data: '' }
    },
    /** A vote asked for on an element — its badge clicked, or `vote` called. */
    onVote: { action: 'onVote', title: 'On Vote', type: 'trigger', params: {}, preview: { id: '' } },
    /** The board's frames, in the order they are gone through: `frames` (`id`, `title`, `count`) and `count`. */
    onFramesChange: {
      action: 'onFramesChange',
      title: 'On Frames Change',
      type: 'trigger',
      params: {},
      preview: { frames: '', count: '' }
    },
    /**
     * A presentation moved on or ended: who gives it (`You` for this page, `''` once it is over), where it is
     * (`position` of `total`) and the frame's `title`.
     */
    onPresentationChange: {
      action: 'onPresentationChange',
      title: 'On Presentation Change',
      type: 'trigger',
      params: {},
      preview: { presenter: '', index: '', position: '', total: '', title: '', mine: '' }
    },
    /** An answer written in a comment's thread, for the page to keep: `id` is the comment, `text` the answer. */
    onReply: { action: 'onReply', title: 'On Reply', type: 'trigger', params: {}, preview: { id: '', text: '' } },
    /** Somebody brought everyone on the board to their view. */
    onSummoned: { action: 'onSummoned', title: 'On Summoned', type: 'trigger', params: {}, preview: { name: '' } },
    /** Whose view this page follows now — a name, or `''` once it stopped (the person touched the board). */
    onFollowChange: {
      action: 'onFollowChange',
      title: 'On Follow Change',
      type: 'trigger',
      params: {},
      preview: { name: '' }
    }
  },
  callbacks: {
    undo: callback('undo', 'Undo'),
    redo: callback('redo', 'Redo'),
    deleteSelection: callback('deleteSelection', 'Delete Selection'),
    selectAll: callback('selectAll', 'Select All'),
    duplicate: callback('duplicate', 'Duplicate'),
    deselect: callback('deselect', 'Deselect'),
    bringToFront: callback('bringToFront', 'Bring To Front'),
    sendToBack: callback('sendToBack', 'Send To Back'),
    /** One group of what is selected: picked up, moved and stacked as one from then on. */
    group: callback('group', 'Group'),
    ungroup: callback('ungroup', 'Ungroup'),
    /** Restyles the selection. Only the params given change: a colour picked leaves the width alone. */
    applyStyle: {
      action: 'applyStyle',
      title: 'Apply Style',
      type: 'callback',
      params: {
        stroke: { label: 'Stroke colour', defaultValue: '', type: 'text' },
        fill: { label: 'Fill colour', defaultValue: '', type: 'text' },
        strokeWidth: { label: 'Stroke width (1 | 2 | 4)', defaultValue: '', type: 'text' },
        dash: { label: 'Outline (solid | dashed | dotted)', defaultValue: '', type: 'text' },
        sloppiness: { label: 'Sloppiness (architect | artist | cartoonist)', defaultValue: '', type: 'text' },
        brush: {
          label: 'Brush (pizarra | brush | fountain | marker | highlighter | pencil | chalk | neon)',
          defaultValue: '',
          type: 'text'
        },
        edges: { label: 'Edges (sharp | round)', defaultValue: '', type: 'text' },
        fillStyle: { label: 'Fill style (hachure | cross | solid)', defaultValue: '', type: 'text' },
        opacity: { label: 'Opacity (10 … 100)', defaultValue: '', type: 'text' }
      }
    },
    bringForward: callback('bringForward', 'Bring Forward'),
    sendBackward: callback('sendBackward', 'Send Backward'),
    /** What is selected, in a tidy grid. */
    tidy: callback('tidy', 'Tidy Up'),
    /** Three kanban columns — To do, Doing, Done — where this person points. */
    insertKanban: callback('insertKanban', 'Insert Kanban'),
    /** Another column beside the one frame selected. */
    addColumn: callback('addColumn', 'Add Column'),
    /** The one card selected ticked done, or the one comment resolved — or back. */
    toggleDone: callback('toggleDone', 'Toggle Done'),
    /** A small sound, for something the page heard or did: a line in the chat, a timer started or stopped, a copy. */
    chime: {
      action: 'chime',
      title: 'Chime',
      type: 'callback',
      params: {
        sound: {
          label: 'Sound — one of SOUNDS in sounds.ts: message, sent, timerStart, timerStop, lock, copy…',
          defaultValue: 'message',
          type: 'text'
        }
      }
    },
    /** The one frame selected made a column — which lays out what is put in it, as a kanban lane — or free again. */
    toggleColumn: callback('toggleColumn', 'Toggle Column'),
    /** A frame, eased into view. */
    goToFrame: {
      action: 'goToFrame',
      title: 'Go To Frame',
      type: 'callback',
      params: { id: { label: 'Frame id', defaultValue: '', type: 'text' } }
    },
    /** The frames, one at a time, for everyone on the board: from the one selected, or the first. */
    present: callback('present', 'Present'),
    /** The page fills the screen — or stops filling it. */
    toggleFullscreen: callback('toggleFullscreen', 'Toggle Fullscreen'),
    stopPresenting: callback('stopPresenting', 'Stop Presenting'),
    /** An arrow key: the next or previous frame while presenting, the selection nudged otherwise (`far`: by ten). */
    step: {
      action: 'step',
      title: 'Step',
      type: 'callback',
      params: {
        direction: { label: 'Direction (left | right | up | down)', defaultValue: 'right', type: 'text' },
        far: { label: 'Ten at a time', defaultValue: '', type: 'text' }
      }
    },
    zoomIn: callback('zoomIn', 'Zoom In'),
    zoomOut: callback('zoomOut', 'Zoom Out'),
    zoomReset: callback('zoomReset', 'Zoom To 100%'),
    zoomToFit: callback('zoomToFit', 'Zoom To Fit'),
    exportPng: callback('exportPng', 'Export PNG'),
    /**
     * The server refused a commit: drop every edit it has not confirmed and draw what it holds. What was refused is
     * gone from this screen, as it never reached any other.
     */
    rollback: callback('rollback', 'Roll Back Unconfirmed'),
    /** A sticky taken off a pad: it follows the pointer until it is put down on the board. */
    carry: {
      action: 'carry',
      title: 'Carry A Sticky',
      type: 'callback',
      params: {
        fill: { label: 'Paper (yellow | red | orange | green | blue | violet)', defaultValue: 'yellow', type: 'text' }
      }
    },
    /** Show what a member of the room shows, and keep showing it until this person touches the board. */
    follow: {
      action: 'follow',
      title: 'Follow',
      type: 'callback',
      params: { from: { label: 'Member (their `from` on the room)', defaultValue: '', type: 'text' } }
    },
    unfollow: callback('unfollow', 'Stop Following'),
    /** The server kept a pasted picture: its element is committed, naming the asset. */
    placeImage: {
      action: 'placeImage',
      title: 'Place Image',
      type: 'callback',
      params: {
        id: { label: 'Element (from On Image Paste)', defaultValue: '', type: 'text' },
        asset: { label: 'Asset id (from the upload)', defaultValue: '', type: 'text' }
      }
    },
    cancelImage: {
      action: 'cancelImage',
      title: 'Cancel Image',
      type: 'callback',
      params: { id: { label: 'Element (from On Image Paste)', defaultValue: '', type: 'text' } }
    },
    vote: callback('vote', 'Vote For Selection'),
    /** Opens the chat field at the cursor: what is typed shows next to it on every screen. */
    chat: callback('chat', 'Cursor Chat'),
    /** Brings everyone on the board to this person's view. */
    summon: callback('summon', 'Bring Everyone Here'),
    /** A stamp put on the board where this person points: an emoji that stays, as a text. */
    stamp: {
      action: 'stamp',
      title: 'Stamp',
      type: 'callback',
      params: { emoji: { label: 'Emoji', defaultValue: '👍', type: 'text' } }
    },
    /** A reaction floating up where this person points, for everyone on the board. */
    react: {
      action: 'react',
      title: 'React',
      type: 'callback',
      params: { emoji: { label: 'Emoji', defaultValue: '👍', type: 'text' } }
    }
  },
  content: {
    attributes: {
      boardId: '',
      topic: '',
      roomTopic: '',
      title: '',
      assetBase: '',
      voter: '',
      mode: 'edit',
      tool: 'select',
      stroke: 'ink',
      fill: 'none',
      strokeWidth: 2,
      scheme: 'light',
      minimap: false
    },
    definition: {
      label: 'Board',
      type: 'board',
      description:
        'An infinite whiteboard in a hand-drawn stroke: pan, zoom, shapes, arrows, lines, freehand, text, sticky ' +
        'notes, cards, and frames that hold what is put in them — a column frame lays it out, as a kanban lane. Bind `elements` to the board as the server keeps it; `topic` is the channel the server announces ' +
        'saved elements on and `roomTopic` the one cursors, live drags, lasers and reactions travel on. It fires ' +
        '`onCommit` with the changed elements for the page to keep, and `onToolChange`, `onSelectionChange`, ' +
        '`onViewChange`, `onResync` and `onFollowChange`. Arrows and lines fix to the anchors of what they are drawn ' +
        'to, and follow it. `carry` takes a sticky off a pad, `follow` shows a member of the room, `react` floats an ' +
        'emoji. Its children are the tools of the selection: shown beside whatever is selected, hidden while it is ' +
        'dragged or typed into. `mode: read` is looked around together and changed by nobody; `mode: view` draws a ' +
        'still preview. `demo` plays scripted collaborators on a board with no room. Colours come from the ' +
        '`--board-*` custom properties.',
      items: [],
      bindings: {},
      styleSelectors: { base: '' },
      initialState: { visibility: true }
    },
    builder: {
      canDelete: true,
      canSelect: true,
      canDragDrop: true,
      canMove: true,
      canTemplate: true,
      // The selection's tools: any element the space authors to stand beside what is selected.
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: 'Canvas',
      owner: 'Plitzi examples',
      license: 'MIT',
      website: '',
      backgroundColor: '#f6f1e7',
      icon: 'fa-solid fa-chalkboard'
    },
    defaultStyle: {
      name: 'Board',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      bindingsAllowed: {
        attributes: [
          { path: 'boardId', label: 'Board id' },
          { path: 'elements', label: 'Elements' },
          { path: 'topic', label: 'Board topic' },
          { path: 'roomTopic', label: 'Room topic' },
          { path: 'title', label: 'Title (the exported file’s name)' },
          { path: 'assetBase', label: 'Where pictures are served from' },
          { path: 'voter', label: 'Voter (the id this visitor keeps)' },
          { path: 'mode', label: 'Mode (edit | read | view)' },
          { path: 'demo', label: 'Played collaborators (a board with no room)' },
          { path: 'tool', label: 'Tool' },
          { path: 'stroke', label: 'Stroke colour' },
          { path: 'fill', label: 'Fill colour' },
          { path: 'strokeWidth', label: 'Stroke width' },
          { path: 'dash', label: 'Outline' },
          { path: 'sloppiness', label: 'Sloppiness' },
          { path: 'brush', label: 'Brush' },
          { path: 'edges', label: 'Edges' },
          { path: 'fillStyle', label: 'Fill style' },
          { path: 'opacity', label: 'Opacity' },
          { path: 'scheme', label: 'Colour scheme' },
          { path: 'author', label: 'Author (whose name goes on notes and cards)' },
          { path: 'authors', label: 'Show who wrote notes and cards' },
          { path: 'sounds', label: 'Make sounds' },
          { path: 'minimap', label: 'Show the minimap' }
        ],
        initialState: []
      }
    },
    settings: {}
  }
} satisfies PluginDeclaration<BoardAttributes>;

export default declaration;
