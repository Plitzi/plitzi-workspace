import {
  byStacking,
  holdsText,
  isAuthored,
  isConnector,
  isLinear,
  isTask,
  takesLabel,
  takesStyle
} from '../../board/model.ts';
import { frameAt, frameUnder, insertionAt, layoutColumn, membersOf as inFrame, moved } from './containers.ts';
import { CARD_WIDTH, measureCard, measureText, STICKY_SIZE } from './draw.ts';
import { editorFor } from './editor.ts';
import { boundsOf, clampZoom, fitCamera, resolveConnector, unionOf } from './geometry.ts';
import { readPalette } from './palette.ts';
import { createSounds } from './sounds.ts';
import { byField, restyled, styleOf } from './styling.ts';
import { createRemotes } from './remotes.ts';
import { createScene } from './scene.ts';
import { newId, newSeed } from './values.ts';

import type { Box, Camera, Handle } from './geometry.ts';
import type { Palette } from './palette.ts';
import type { Carrying, ControllerEvent, ControllerProps, Gesture, Pinch, Tool, View } from './types.ts';
import type { Binding, BoardElement, Fill, Point, ShapeType, StyleField } from '../../board/model.ts';
import type { Collaborator } from '../../board/people.ts';

/**
 * What every part of the canvas shares: the scene and what is drawn over it, the camera, the selection, and the few
 * operations each of them needs — drawing again, committing, selecting, reporting to the page.
 *
 * The pointer, the renderer, the carried sticky and the page's API are each their own module over this one. Mutable
 * state lives in `state`, read where it is used, so no module keeps a stale copy of another's.
 */

export const DEFAULT_BOX: Record<'sticky' | 'shape' | 'card' | 'frame' | 'column', { width: number; height: number }> =
  {
    sticky: { width: STICKY_SIZE, height: STICKY_SIZE },
    shape: { width: 140, height: 90 },
    card: { width: CARD_WIDTH, height: 60 },
    frame: { width: 480, height: 360 },
    column: { width: 300, height: 460 }
  };

/** A pile on the board: a note's size, with its strip below and the notes under it showing. */
export const STACK_BOX = { width: 222, height: 252 };

export const CURSORS: Record<Tool, string> = {
  select: 'default',
  hand: 'grab',
  rectangle: 'crosshair',
  ellipse: 'crosshair',
  diamond: 'crosshair',
  triangle: 'crosshair',
  hexagon: 'crosshair',
  cylinder: 'crosshair',
  star: 'crosshair',
  arrow: 'crosshair',
  line: 'crosshair',
  freehand: 'crosshair',
  text: 'text',
  sticky: 'crosshair',
  card: 'crosshair',
  frame: 'crosshair',
  column: 'crosshair',
  comment: 'crosshair',
  eraser: 'cell',
  laser: 'crosshair'
};

export const HANDLE_CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize'
};

/** The style a selection shares, one field at a time: `''` where its elements disagree. */
const shared = (elements: readonly BoardElement[], pick: (element: BoardElement) => string): string => {
  const values = new Set(elements.map(pick));

  return values.size === 1 ? [...values][0] : '';
};

export type CoreState = {
  props: ControllerProps;
  palette: Palette;
  camera: Camera;
  size: { width: number; height: number; dpr: number };
  members: Map<string, Collaborator>;
  boardId: string | undefined;
  gesture: Gesture | undefined;
  pinch: Pinch | undefined;
  /** The element being typed into. */
  editing: string | undefined;
  spaceHeld: boolean;
  fitPending: boolean;
  lastPointer: Point | undefined;
  /**
   * The group this person double-clicked into: its members are picked one at a time until the selection leaves it.
   * Everywhere else a click on a member picks up the whole group.
   */
  insideGroup: string | undefined;
  /** The shape under the pointer, whose connection points show. */
  hovered: string | undefined;
  /** The anchor a connector being drawn will fix to if let go now. */
  snapping: Binding | undefined;
  carrying: Carrying | undefined;
  /** The member whose view this page follows. */
  following: string | undefined;
  /** What this person is typing at their cursor, while the chat field is open. */
  chatting: string | undefined;
  /**
   * Where what is being dragged would land: the frame under the pointer — and, in a column, the board `y` of the gap
   * it would go into. Drawn as a suggestion until it is let go.
   */
  dropTarget: { frame: string; line?: number; home?: boolean } | undefined;
  /** What the pointer is over, whatever it is: a comment there opens its bubble. */
  pointed: string | undefined;
};

export const createCore = (canvas: HTMLCanvasElement, host: HTMLElement, emit: (event: ControllerEvent) => void) => {
  const context2d = canvas.getContext('2d');
  if (!context2d) {
    throw new Error('This browser cannot draw on a canvas');
  }

  // Named once narrowed: the functions below close over it, which a narrowing does not reach.
  const context: CanvasRenderingContext2D = context2d;
  const scene = createScene();
  const selection = new Set<string>();
  /** This person's gesture, drawn over the scene until it ends and is committed. */
  const draft = new Map<string, BoardElement>();
  let frame = 0;
  let paint: () => void = () => undefined;
  let reportedZoom = 0;

  const invalidate = (): void => {
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        paint();
      });
    }
  };

  const remotes = createRemotes(ms => setTimeout(invalidate, ms));
  /** The board's cues, for every part of the canvas to play: what one's own hand does, and what the others do. */
  const sounds = createSounds();

  const state: CoreState = {
    props: {
      tool: 'select',
      stroke: 'ink',
      fill: 'none',
      strokeWidth: 2,
      mode: 'edit',
      title: '',
      assetBase: '',
      voter: '',
      author: '',
      authors: true,
      sounds: true,
      extras: {}
    },
    palette: readPalette(host),
    camera: { x: 0, y: 0, zoom: 1 },
    size: { width: 0, height: 0, dpr: 1 },
    members: new Map(),
    boardId: undefined,
    gesture: undefined,
    pinch: undefined,
    editing: undefined,
    spaceHeld: false,
    fitPending: true,
    lastPointer: undefined,
    insideGroup: undefined,
    hovered: undefined,
    snapping: undefined,
    carrying: undefined,
    following: undefined,
    chatting: undefined,
    dropTarget: undefined,
    pointed: undefined
  };

  /** Anything can change: the board is in `edit` mode. */
  const editable = (): boolean => state.props.mode === 'edit';

  /** Somebody is on the board — editing or looking around — rather than it being a still preview. */
  const present = (): boolean => state.props.mode !== 'view';

  /** The pointer while nothing is under it: the tool's — or, on a board that cannot change, a hand to pan with. */
  const restCursor = (): string => (!editable() && state.props.tool !== 'laser' ? 'grab' : CURSORS[state.props.tool]);

  // ── What is drawn ───────────────────────────────────────────────────────────────────────────────────────────────

  const displayed = (now = Date.now()): BoardElement[] => {
    const elements = new Map(scene.visible().map(element => [element.id, element]));
    const versionOf = (id: string): number => scene.element(id)?.version ?? 0;
    for (const element of [...remotes.drafts(now, versionOf), ...draft.values()]) {
      if (element.deleted) {
        elements.delete(element.id);
      } else {
        elements.set(element.id, element);
      }
    }

    // Every connector drawn from where its elements are NOW — a shape being dragged pulls its arrows along with it.
    return [...elements.values()]
      .map(element =>
        isConnector(element.type) && (element.start || element.end)
          ? resolveConnector(element, id => elements.get(id))
          : element
      )
      .sort(byStacking);
  };

  const current = (): Map<string, BoardElement> => new Map(displayed().map(element => [element.id, element]));

  /** What is selected, as it is drawn: a connector with its ends where its elements are. */
  const selected = (): BoardElement[] => {
    const shown = current();

    return [...selection].map(id => shown.get(id)).filter((element): element is BoardElement => element !== undefined);
  };

  /** The one connector selected, when that is the whole selection: its ends are what the handles move. */
  const soleConnector = (): BoardElement | undefined => {
    const chosen = selected();

    return chosen.length === 1 && isConnector(chosen[0].type) ? chosen[0] : undefined;
  };

  const viewport = (): Box => ({
    x: state.camera.x,
    y: state.camera.y,
    width: state.size.width / state.camera.zoom,
    height: state.size.height / state.camera.zoom
  });

  const viewOf = (box: Box): View => [
    Math.round(box.x),
    Math.round(box.y),
    Math.round(box.width),
    Math.round(box.height)
  ];

  /** Where something with no pointer to go by lands: the pointer if it is on the board, else the middle of the view. */
  const aim = (): Point => {
    const view = viewport();

    return state.lastPointer ?? [view.x + view.width / 2, view.y + view.height / 2];
  };

  // ── What the page hears ─────────────────────────────────────────────────────────────────────────────────────────

  const reportView = (): void => {
    const zoom = Math.round(state.camera.zoom * 100);
    if (zoom !== reportedZoom) {
      reportedZoom = zoom;
      emit({ type: 'view', zoom });
    }
  };

  const reportSelection = (): void => {
    const chosen = selected();
    const sole = chosen.length === 1 ? chosen[0] : undefined;
    const offering = (field: StyleField): BoardElement[] => chosen.filter(element => takesStyle(element.type, field));
    emit({
      type: 'selection',
      count: chosen.length,
      grouped: chosen.some(element => element.group !== undefined),
      oneGroup:
        chosen.length > 0 &&
        chosen[0].group !== undefined &&
        chosen.every(element => element.group === chosen[0].group),
      style: byField(field => shared(offering(field), element => styleOf(element, field))),
      stylable: byField(field => offering(field).length > 0),
      frame: sole?.type === 'frame',
      column: sole?.type === 'frame' && sole.layout === 'column',
      task: sole !== undefined && isTask(sole.type),
      done: sole?.done === true
    });
  };

  /** The version this page's draft of an element will be committed at: what the others compare it against. */
  const predicted = (element: BoardElement): BoardElement => ({
    ...element,
    version: (scene.element(element.id)?.version ?? 0) + 1
  });

  const reportPointer = (final: boolean): void => {
    if (!present()) {
      return;
    }

    const { lastPointer, gesture, chatting } = state;
    emit({
      type: 'pointer',
      final,
      message: {
        ...(lastPointer ? { x: Math.round(lastPointer[0]), y: Math.round(lastPointer[1]) } : {}),
        draft: draft.size && !final ? [...draft.values()].map(predicted) : null,
        selection: [...selection].slice(0, 50),
        view: viewOf(viewport()),
        ...(gesture?.kind === 'laser' ? { laser: true } : {}),
        ...(chatting === undefined ? {} : { chat: chatting })
      }
    });
  };

  const reportEditor = (): void => {
    const element = state.editing ? (draft.get(state.editing) ?? scene.element(state.editing)) : undefined;
    emit({
      type: 'editor',
      editor: element ? editorFor(element, state.camera, state.palette, context) : undefined
    });
  };

  // ── The camera ──────────────────────────────────────────────────────────────────────────────────────────────────

  const setCamera = (next: Camera): void => {
    state.camera = next;
    reportView();
    reportEditor();
    // A follower's view is set from this, as it changes — not only when the pointer moves.
    reportPointer(false);
    invalidate();
  };

  const stopFollowing = (): void => {
    if (state.following) {
      sounds.play('unfollow');
      state.following = undefined;
      emit({ type: 'follow', name: '' });
    }
  };

  /** Shows what a followed member shows: the same middle, at the zoom that fits their view in this one. */
  const showView = ([x, y, width, height]: View): void => {
    const { size } = state;
    const zoom = clampZoom(Math.min(size.width / Math.max(width, 1), size.height / Math.max(height, 1)));
    setCamera({ x: x + width / 2 - size.width / 2 / zoom, y: y + height / 2 - size.height / 2 / zoom, zoom });
  };

  let glide = 0;

  /** The camera eased to `target` — a move somebody should be able to follow with their eyes, not a jump. */
  const glideTo = (target: Camera, ms = 380): void => {
    cancelAnimationFrame(glide);
    const from = state.camera;
    const started = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - started) / ms);
      const eased = 1 - (1 - t) ** 3;
      // Zoom eased in its own scale: halfway from 0.5 to 2 is 1, not 1.25.
      const zoom = Math.exp(Math.log(from.zoom) + (Math.log(target.zoom) - Math.log(from.zoom)) * eased);
      const centre = (camera: Camera, axis: 'x' | 'y'): number =>
        camera[axis] + (axis === 'x' ? state.size.width : state.size.height) / 2 / camera.zoom;
      const [cx, cy] = [
        centre(from, 'x') + (centre(target, 'x') - centre(from, 'x')) * eased,
        centre(from, 'y') + (centre(target, 'y') - centre(from, 'y')) * eased
      ];
      setCamera({ x: cx - state.size.width / 2 / zoom, y: cy - state.size.height / 2 / zoom, zoom });
      if (t < 1) {
        glide = requestAnimationFrame(step);
      }
    };
    glide = requestAnimationFrame(step);
  };

  const fit = (): void => {
    const box = unionOf(scene.visible().map(boundsOf));
    const { size } = state;
    setCamera(
      box && box.width + box.height > 0
        ? fitCamera(box, size.width, size.height, present() ? 64 : 12)
        : { x: -size.width / 2, y: -size.height / 2, zoom: 1 }
    );
  };

  // ── The selection ───────────────────────────────────────────────────────────────────────────────────────────────

  const groupOf = (id: string): string | undefined => (draft.get(id) ?? scene.element(id))?.group;

  const membersOf = (group: string): string[] =>
    scene
      .visible()
      .filter(element => element.group === group)
      .map(element => element.id);

  /** What picking these picks: each whole group — the entered one aside, whose members are picked alone. */
  const widened = (ids: Iterable<string>): Set<string> => {
    const chosen = new Set(ids);
    for (const id of [...chosen]) {
      const group = groupOf(id);
      if (group && group !== state.insideGroup) {
        membersOf(group).forEach(member => chosen.add(member));
      }
    }

    return chosen;
  };

  const setSelection = (ids: Iterable<string>): void => {
    const chosen = [...ids];
    if (state.insideGroup && !chosen.some(id => groupOf(id) === state.insideGroup)) {
      state.insideGroup = undefined;
    }

    selection.clear();
    for (const id of widened(chosen)) {
      selection.add(id);
    }

    reportSelection();
    reportPointer(false);
    invalidate();
  };

  // ── Changes ─────────────────────────────────────────────────────────────────────────────────────────────────────

  /** A text's box is what its lines take, and a card's height what its words do: measured once they are typed. */
  const measured = (element: BoardElement): BoardElement => {
    if (element.type === 'text') {
      return { ...element, ...measureText(context, element, state.palette) };
    }

    return element.type === 'card' ? { ...element, height: measureCard(context, element, state.palette) } : element;
  };

  /**
   * What a change does to the frames around it, added to it: something new goes into the frame it is made in; a frame
   * removed lets go of what was in it; and every column something left, entered, or changed in is laid out again — so
   * a card dropped in a column takes its place there, and the gap it left in the other one closes.
   */
  const settle = (changes: readonly BoardElement[]): BoardElement[] => {
    const next = new Map(changes.map(change => [change.id, change]));
    // Everything as it will be, kept current as the pass adds to it: one read of the scene, however big the change.
    const all = current();
    const put = (element: BoardElement): void => {
      next.set(element.id, element);
      all.set(element.id, element);
    };
    changes.forEach(change => all.set(change.id, change));
    const frames = [...all.values()].filter(element => element.type === 'frame').sort(byStacking);

    for (const change of changes) {
      if (!scene.element(change.id) && change.parent === undefined && !change.deleted) {
        const frame = frameUnder(frames, change);
        if (frame) {
          put({ ...change, parent: frame.id });
        }
      }

      if (change.type === 'frame' && change.deleted) {
        for (const member of inFrame([...all.values()], change.id)) {
          const { parent: _parent, ...free } = member;
          put(free);
        }
      }
    }

    const columns = new Set<string>();
    for (const change of next.values()) {
      [change.parent, scene.element(change.id)?.parent, change.type === 'frame' ? change.id : undefined]
        .filter((id): id is string => id !== undefined)
        .forEach(id => columns.add(id));
    }

    for (const id of columns) {
      const column = all.get(id);
      if (column?.type === 'frame' && column.layout === 'column' && !column.deleted) {
        for (const laid of layoutColumn(column, inFrame([...all.values()], id), measured)) {
          if (moved(all.get(laid.id), laid)) {
            put(laid);
          }
        }
      }
    }

    return [...next.values()];
  };

  /**
   * What letting go at `point` would do, shown before it is done: the frame there — unless it is the one `from`, a
   * free area the dragged things are already in — and, in a column, the gap they would go into.
   */
  const aimDrop = (point: Point | undefined, excluding: ReadonlySet<string>, from?: string): void => {
    const shown = displayed().filter(element => !excluding.has(element.id));
    const frame = point ? frameAt(shown, point, excluding) : undefined;
    const column = frame?.layout === 'column';
    const home = from ? current().get(from) : undefined;
    // Out of a column and over no frame: a kanban card is not left loose on the board — its column is shown, which
    // is where it goes back to.
    const next =
      point && frame && (column || frame.id !== from)
        ? { frame: frame.id, ...(column ? { line: insertionAt(frame, inFrame(shown, frame.id), point[1]) } : {}) }
        : point && !frame && home?.layout === 'column'
          ? { frame: home.id, home: true }
          : undefined;
    if (JSON.stringify(next) !== JSON.stringify(state.dropTarget)) {
      state.dropTarget = next;
      invalidate();
    }
  };

  /** Whether a point is inside a frame's area. */
  const frameContains = (id: string, [x, y]: Point): boolean => {
    const frame = current().get(id);

    return (
      frame !== undefined && x >= frame.x && x <= frame.x + frame.width && y >= frame.y && y <= frame.y + frame.height
    );
  };

  const commit = (changes: readonly BoardElement[]): void => {
    const ops = scene.commit(settle(changes));
    if (ops.length) {
      emit({ type: 'commit', ops });
    }

    invalidate();
  };

  /** Ops the scene already applied — an undo, a redo — sent, and the selection cleared of what they removed. */
  const send = (ops: BoardElement[]): void => {
    if (ops.length) {
      emit({ type: 'commit', ops });
    }

    for (const id of selection) {
      if (scene.element(id)?.deleted ?? true) {
        selection.delete(id);
      }
    }

    reportSelection();
    invalidate();
  };

  const switchTool = (tool: Tool): void => {
    if (tool !== state.props.tool) {
      state.props = { ...state.props, tool };
      canvas.style.cursor = restCursor();
      emit({ type: 'tool', tool });
    }
  };

  const newElement = (type: ShapeType, [x, y]: Point): BoardElement => {
    const { props } = state;
    const paper = type === 'sticky' || type === 'stack';
    const fill: Fill = !takesStyle(type, 'fill') ? 'none' : paper && props.fill === 'none' ? 'yellow' : props.fill;

    return restyled(
      {
        id: newId(),
        type,
        x,
        y,
        width: 0,
        height: 0,
        stroke: props.stroke,
        fill,
        strokeWidth: props.strokeWidth,
        seed: newSeed(),
        z: scene.topZ + 1,
        version: 0,
        nonce: 0,
        deleted: false,
        ...(isLinear(type) ? { points: [[0, 0]] as Point[] } : {}),
        ...(holdsText(type) ? { text: '' } : {}),
        ...(isAuthored(type) && props.author ? { author: props.author } : {})
      },
      props.extras
    );
  };

  // ── Typing ──────────────────────────────────────────────────────────────────────────────────────────────────────

  const startEditing = (element: BoardElement): void => {
    // A comment left waiting with words in it is posted, not lost, when something else is written.
    if (state.editing && state.editing !== element.id) {
      finishEditing(true);
    }

    state.editing = element.id;
    draft.set(element.id, element);
    reportEditor();
    invalidate();
  };

  /** What is being typed, dropped: a new element never made, an edited one as it was. */
  const cancelEditing = (): void => {
    const id = state.editing;
    if (!id) {
      return;
    }

    state.editing = undefined;
    draft.delete(id);
    emit({ type: 'editor', editor: undefined });
    invalidate();
  };

  /**
   * Typing is over: what was typed is kept. A comment is the exception — it is POSTED, on purpose (`explicit`: its
   * button, or Enter). Looking away from one with words in it leaves it open, waiting; with none, it goes.
   */
  const finishEditing = (explicit = false): void => {
    const id = state.editing;
    if (!id) {
      return;
    }

    const element = draft.get(id);
    if (element?.type === 'comment' && !explicit) {
      if ((element.text ?? '').trim()) {
        return;
      }

      cancelEditing();

      return;
    }

    state.editing = undefined;
    draft.delete(id);
    emit({ type: 'editor', editor: undefined });
    if (!element) {
      invalidate();

      return;
    }

    const saved = scene.element(id);
    const empty = !(element.text ?? '').trim();
    if (takesLabel(element.type)) {
      // A label emptied is no label: the key goes, rather than an empty string being kept and sent.
      const { text, ...shape } = element;
      const labelled = empty ? shape : { ...shape, text };
      if ((saved?.text ?? '') !== (empty ? '' : text)) {
        commit([labelled]);
      }

      setSelection([id]);

      return;
    }

    // A text or a comment with nothing in it is not kept: it would be a thing nobody can see or read.
    if ((element.type === 'text' || element.type === 'comment') && empty) {
      if (saved && !saved.deleted) {
        commit([{ ...saved, deleted: true }]);
      }

      selection.delete(id);
      reportSelection();
      invalidate();

      return;
    }

    if (!saved || saved.text !== element.text) {
      commit([measured(element)]);
      // Something new written down: a comment's bubble, or a text put on the board.
      if (!saved && (element.type === 'comment' || element.type === 'text')) {
        sounds.play(element.type === 'comment' ? 'comment' : 'place');
      }
    }

    setSelection([id]);
  };

  return {
    canvas,
    host,
    context,
    emit,
    scene,
    selection,
    draft,
    remotes,
    sounds,
    state,
    /** The one function that draws a frame — the renderer's, handed in once it exists. */
    paintWith: (next: () => void): void => {
      paint = next;
    },
    cancelFrame: (): void => cancelAnimationFrame(frame),
    invalidate,
    editable,
    present,
    restCursor,
    displayed,
    current,
    selected,
    soleConnector,
    viewport,
    viewOf,
    aim,
    reportSelection,
    reportPointer,
    reportEditor,
    setCamera,
    glideTo,
    stopFollowing,
    showView,
    fit,
    membersOf,
    setSelection,
    commit,
    send,
    switchTool,
    newElement,
    measured,
    aimDrop,
    frameContains,
    startEditing,
    finishEditing,
    cancelEditing
  };
};

export type Core = ReturnType<typeof createCore>;
