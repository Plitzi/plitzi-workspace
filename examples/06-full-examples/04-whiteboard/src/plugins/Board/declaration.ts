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
        canStroke: '',
        canFill: '',
        canWidth: ''
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
        strokeWidth: { label: 'Stroke width (1 | 2 | 4)', defaultValue: '', type: 'text' }
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
      scheme: 'light'
    },
    definition: {
      label: 'Board',
      type: 'board',
      description:
        'An infinite whiteboard in a hand-drawn stroke: pan, zoom, shapes, arrows, lines, freehand, text and sticky ' +
        'notes. Bind `elements` to the board as the server keeps it; `topic` is the channel the server announces ' +
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
          { path: 'scheme', label: 'Colour scheme' }
        ],
        initialState: []
      }
    },
    settings: {}
  }
} satisfies PluginDeclaration<BoardAttributes>;

export default declaration;
