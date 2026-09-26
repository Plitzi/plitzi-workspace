import { holdsText, isConnector, isLinear, takesLabel, takesStyle } from '../../board/model.ts';
import { measureText, STICKY_SIZE } from './draw.ts';
import { editorFor } from './editor.ts';
import { boundsOf, clampZoom, fitCamera, resolveConnector, unionOf } from './geometry.ts';
import { readPalette } from './palette.ts';
import { createRemotes } from './remotes.ts';
import { createScene } from './scene.ts';
import { byZ, newId, newSeed } from './values.ts';

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

export const DEFAULT_BOX: Record<'sticky' | 'shape', { width: number; height: number }> = {
  sticky: { width: STICKY_SIZE, height: STICKY_SIZE },
  shape: { width: 140, height: 90 }
};

/** A pile on the board: a note's size, with its strip below and the notes under it showing. */
export const STACK_BOX = { width: 222, height: 252 };

export const CURSORS: Record<Tool, string> = {
  select: 'default',
  hand: 'grab',
  rectangle: 'crosshair',
  ellipse: 'crosshair',
  diamond: 'crosshair',
  arrow: 'crosshair',
  line: 'crosshair',
  freehand: 'crosshair',
  text: 'text',
  sticky: 'crosshair',
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

  const state: CoreState = {
    props: {
      tool: 'select',
      stroke: 'ink',
      fill: 'none',
      strokeWidth: 2,
      mode: 'edit',
      title: '',
      assetBase: '',
      voter: ''
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
    chatting: undefined
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
      .sort(byZ);
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
    const offering = (field: StyleField): BoardElement[] => chosen.filter(element => takesStyle(element.type, field));
    const [stroke, fill, width] = [offering('stroke'), offering('fill'), offering('strokeWidth')];
    emit({
      type: 'selection',
      count: chosen.length,
      grouped: chosen.some(element => element.group !== undefined),
      oneGroup:
        chosen.length > 0 &&
        chosen[0].group !== undefined &&
        chosen.every(element => element.group === chosen[0].group),
      stroke: shared(stroke, element => element.stroke),
      fill: shared(fill, element => element.fill),
      strokeWidth: shared(width, element => String(element.strokeWidth)),
      stylable: { stroke: stroke.length > 0, fill: fill.length > 0, strokeWidth: width.length > 0 }
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

  const commit = (changes: readonly BoardElement[]): void => {
    const ops = scene.commit(changes);
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

    return {
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
      ...(holdsText(type) ? { text: '' } : {})
    };
  };

  /** A text's box is what its lines take: measured once it is typed, so hit testing and the selection fit it. */
  const measured = (element: BoardElement): BoardElement =>
    element.type === 'text' ? { ...element, ...measureText(context, element, state.palette) } : element;

  // ── Typing ──────────────────────────────────────────────────────────────────────────────────────────────────────

  const startEditing = (element: BoardElement): void => {
    state.editing = element.id;
    draft.set(element.id, element);
    reportEditor();
    invalidate();
  };

  const finishEditing = (): void => {
    const id = state.editing;
    if (!id) {
      return;
    }

    const element = draft.get(id);
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

    if (element.type === 'text' && empty) {
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
    startEditing,
    finishEditing
  };
};

export type Core = ReturnType<typeof createCore>;
