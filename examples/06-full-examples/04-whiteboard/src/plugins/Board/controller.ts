import { FILLS, LIMITS, STROKES, STROKE_WIDTHS, holdsText, isLinear, parseElement } from '../../board/model.ts';
import {
  drawCursor,
  drawDots,
  drawHandles,
  drawMarquee,
  drawOutline,
  fontSizeOf,
  measureText,
  STICKY_PADDING,
  STICKY_SIZE,
  createRenderer
} from './draw.ts';
import {
  anchorOf,
  boundsOf,
  boxFrom,
  capPoints,
  contains,
  fitCamera,
  handlePoint,
  HANDLES,
  hits,
  scaleElement,
  snapAngle,
  toBoard,
  toScreen,
  unionOf,
  zoomAt
} from './geometry.ts';
import { readPalette } from './palette.ts';
import { createScene } from './scene.ts';

import type { Box, Camera, Handle } from './geometry.ts';
import type { Palette } from './palette.ts';
import type { BoardElement, Fill, Point, ShapeType, Stroke, StrokeWidth } from '../../board/model.ts';
import type { Collaborator } from '../../board/people.ts';

export const TOOLS = [
  'select',
  'hand',
  'rectangle',
  'ellipse',
  'diamond',
  'arrow',
  'line',
  'freehand',
  'text',
  'sticky',
  'eraser'
] as const;

export type Tool = (typeof TOOLS)[number];

export type ControllerProps = {
  tool: Tool;
  stroke: Stroke;
  fill: Fill;
  strokeWidth: StrokeWidth;
  mode: 'edit' | 'view';
  title: string;
};

/** Where the text being typed sits on screen, for the field the component lays over the canvas. */
export type TextEditor = {
  id: string;
  text: string;
  left: number;
  top: number;
  width: number;
  minHeight: number;
  fontSize: number;
  font: string;
  color: string;
  padding: number;
  /** A sticky wraps at its width; a text grows with what is typed. */
  wraps: boolean;
};

/** Where the selection is on screen, for the tools the component lays beside it. */
export type ScreenBox = { left: number; top: number; width: number; height: number };

/** What this page says to the room while its pointer moves: where it is, what it is dragging, what it selected. */
export type PointerMessage = { x: number; y: number; draft: BoardElement[] | null; selection: string[] };

export type ControllerEvent =
  | { type: 'commit'; ops: BoardElement[] }
  | { type: 'tool'; tool: Tool }
  | {
      type: 'selection';
      count: number;
      /** Something selected is in a group. */
      grouped: boolean;
      /** Everything selected is ONE group — grouping it again would change nothing. */
      oneGroup: boolean;
      stroke: string;
      fill: string;
      strokeWidth: string;
    }
  | { type: 'selectionBox'; box: ScreenBox | undefined }
  | { type: 'view'; zoom: number }
  | { type: 'editor'; editor: TextEditor | undefined }
  | { type: 'pointer'; message: PointerMessage; final: boolean };

type Gesture =
  | { kind: 'pan'; start: Point; camera: Camera }
  | { kind: 'move'; origin: Point; originals: BoardElement[] }
  | { kind: 'resize'; handle: Handle; anchor: Point; box: Box; originals: BoardElement[] }
  | { kind: 'marquee'; origin: Point; current: Point; base: Set<string> }
  | { kind: 'box'; origin: Point; element: BoardElement }
  | { kind: 'linear'; origin: Point; element: BoardElement }
  | { kind: 'freehand'; element: BoardElement }
  | { kind: 'erase'; erased: Set<string> };

type Remote = {
  cursor?: Point;
  heardAt: number;
  draft: Map<string, BoardElement>;
  /** When the member's drag ended: its draft is drawn until the server's answer catches up, or this long after. */
  draftEndedAt?: number;
  selection: string[];
};

const REMOTE_DRAFT_GRACE_MS = 1500;

/** A cursor nobody has moved for this long is somebody who walked away: it stops being drawn. */
const CURSOR_IDLE_MS = 60_000;

const DEFAULT_BOX: Record<'sticky' | 'shape', { width: number; height: number }> = {
  sticky: { width: STICKY_SIZE, height: STICKY_SIZE },
  shape: { width: 140, height: 90 }
};

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const newId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');

const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);

const byZ = (a: BoardElement, b: BoardElement): number => a.z - b.z || (a.id < b.id ? -1 : 1);

const isOneOf = <T extends string | number>(values: readonly T[], value: unknown): value is T =>
  values.some(entry => entry === value);

const isPoint = (value: unknown): value is Point =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every(entry => typeof entry === 'number' && Number.isFinite(entry));

const CURSORS: Record<Tool, string> = {
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
  eraser: 'cell'
};

const HANDLE_CURSORS: Record<Handle, string> = {
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

/**
 * The canvas, without React: a scene, a camera, a pointer, and a renderer.
 *
 * Everything that happens sixty times a second lives here, in plain objects and one animation frame. The component
 * around it hands it props, forwards what the channels hear, and turns what it `emit`s into the element's events.
 */
export const createBoardController = (
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  emit: (event: ControllerEvent) => void
) => {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('This browser cannot draw on a canvas');
  }

  const renderer = createRenderer(canvas);
  const scene = createScene();
  const selection = new Set<string>();
  /** This person's gesture, drawn over the scene until it ends and is committed. */
  const draft = new Map<string, BoardElement>();
  const remotes = new Map<string, Remote>();
  const pointers = new Map<number, Point>();
  let members = new Map<string, Collaborator>();
  let props: ControllerProps = { tool: 'select', stroke: 'ink', fill: 'none', strokeWidth: 2, mode: 'edit', title: '' };
  let palette: Palette = readPalette(host);
  let camera: Camera = { x: 0, y: 0, zoom: 1 };
  let size = { width: 0, height: 0, dpr: 1 };
  let boardId: string | undefined;
  let gesture: Gesture | undefined;
  let pinch: { distance: number; center: Point; camera: Camera } | undefined;
  let editing: string | undefined;
  let spaceHeld = false;
  let fitPending = true;
  let frame = 0;
  let lastPointer: Point | undefined;
  let reportedZoom = 0;
  let reportedBox = '';
  /**
   * The group this person double-clicked into: its members are picked one at a time until the selection leaves it.
   * Everywhere else a click on a member picks up the whole group.
   */
  let insideGroup: string | undefined;

  // ── Drawing ──────────────────────────────────────────────────────────────────────────────────────────────────────

  /** What remote drafts still show: until the server's answer is at least as new, or the grace is over. */
  const remoteDrafts = (now: number): BoardElement[] => {
    const shown: BoardElement[] = [];
    for (const remote of remotes.values()) {
      if (remote.draftEndedAt !== undefined && now - remote.draftEndedAt > REMOTE_DRAFT_GRACE_MS) {
        remote.draft.clear();
        remote.draftEndedAt = undefined;
      }

      for (const element of remote.draft.values()) {
        if ((scene.element(element.id)?.version ?? 0) < element.version) {
          shown.push(element);
        }
      }
    }

    return shown;
  };

  const displayed = (now = Date.now()): BoardElement[] => {
    const elements = new Map(scene.visible().map(element => [element.id, element]));
    for (const element of [...remoteDrafts(now), ...draft.values()]) {
      if (element.deleted) {
        elements.delete(element.id);
      } else {
        elements.set(element.id, element);
      }
    }

    return [...elements.values()].sort(byZ);
  };

  const selected = (): BoardElement[] =>
    [...selection]
      .map(id => draft.get(id) ?? scene.element(id))
      .filter((element): element is BoardElement => element !== undefined && !element.deleted);

  const viewport = (): Box => ({
    x: camera.x,
    y: camera.y,
    width: size.width / camera.zoom,
    height: size.height / camera.zoom
  });

  const overlaps = (a: Box, b: Box, margin: number): boolean =>
    a.x - margin < b.x + b.width &&
    a.x + a.width + margin > b.x &&
    a.y - margin < b.y + b.height &&
    a.y + a.height + margin > b.y;

  const colourOf = (from: string): string => palette.collab[members.get(from)?.color ?? ''] ?? palette.accent;

  const render = (): void => {
    frame = 0;
    const { width, height, dpr } = size;
    if (!width || !height) {
      return;
    }

    const now = Date.now();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = palette.paper;
    context.fillRect(0, 0, width, height);
    if (props.mode === 'edit') {
      drawDots(context, camera, width, height, palette.dots);
    }

    const elements = displayed(now);
    const view = viewport();
    const erased = gesture?.kind === 'erase' ? gesture.erased : undefined;
    context.setTransform(
      dpr * camera.zoom,
      0,
      0,
      dpr * camera.zoom,
      -camera.x * camera.zoom * dpr,
      -camera.y * camera.zoom * dpr
    );
    for (const element of elements) {
      if (overlaps(boundsOf(element), view, 40)) {
        renderer.drawElement(context, element, palette, {
          hideText: element.id === editing,
          faded: erased?.has(element.id) ?? false
        });
      }
    }

    renderer.prune(new Set(elements.map(element => element.id)));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (props.mode === 'view') {
      return;
    }

    const byId = new Map(elements.map(element => [element.id, element]));
    for (const [from, remote] of remotes) {
      for (const id of remote.selection) {
        const element = byId.get(id);
        if (element) {
          drawOutline(context, camera, boundsOf(element), colourOf(from), false);
        }
      }
    }

    const chosen = selected();
    for (const element of chosen) {
      drawOutline(context, camera, boundsOf(element), palette.accent, true);
    }

    const box = unionOf(chosen.map(boundsOf));
    if (box && props.tool === 'select' && !editing && (!gesture || gesture.kind === 'resize')) {
      drawHandles(context, camera, box, palette.accent);
    }

    if (gesture?.kind === 'marquee') {
      drawMarquee(context, camera, boxFrom(gesture.origin, gesture.current), palette.accent);
    }

    for (const [from, remote] of remotes) {
      const member = members.get(from);
      if (remote.cursor && member && now - remote.heardAt < CURSOR_IDLE_MS) {
        drawCursor(context, camera, remote.cursor, member.name, colourOf(from), palette.ui);
      }
    }

    // The selection's tools stand aside while it is being moved, resized or typed into — they would cover the work.
    reportBox(box && props.tool === 'select' && !editing && !gesture && !pinch ? box : undefined);
  };

  function reportBox(box: Box | undefined): void {
    const [left, top] = box ? toScreen(camera, box.x, box.y) : [0, 0];
    const screen = box
      ? {
          left: Math.round(left),
          top: Math.round(top),
          width: Math.round(box.width * camera.zoom),
          height: Math.round(box.height * camera.zoom)
        }
      : undefined;
    const key = JSON.stringify(screen ?? null);
    if (key !== reportedBox) {
      reportedBox = key;
      emit({ type: 'selectionBox', box: screen });
    }
  }

  const invalidate = (): void => {
    if (!frame) {
      frame = requestAnimationFrame(render);
    }
  };

  const reportView = (): void => {
    const zoom = Math.round(camera.zoom * 100);
    if (zoom !== reportedZoom) {
      reportedZoom = zoom;
      emit({ type: 'view', zoom });
    }
  };

  const setCamera = (next: Camera): void => {
    camera = next;
    reportView();
    reportEditor();
    invalidate();
  };

  const contentBox = (): Box | undefined => unionOf(scene.visible().map(boundsOf));

  const fit = (): void => {
    const box = contentBox();
    setCamera(
      box && box.width + box.height > 0
        ? fitCamera(box, size.width, size.height, props.mode === 'view' ? 12 : 64)
        : { x: -size.width / 2, y: -size.height / 2, zoom: 1 }
    );
  };

  // ── What this person did ─────────────────────────────────────────────────────────────────────────────────────────

  const reportSelection = (): void => {
    const chosen = selected();
    emit({
      type: 'selection',
      count: chosen.length,
      grouped: chosen.some(element => element.group !== undefined),
      oneGroup:
        chosen.length > 0 &&
        chosen[0].group !== undefined &&
        chosen.every(element => element.group === chosen[0].group),
      stroke: shared(chosen, element => element.stroke),
      fill: shared(
        chosen.filter(element => !isLinear(element.type) && element.type !== 'text'),
        element => element.fill
      ),
      strokeWidth: shared(chosen, element => String(element.strokeWidth))
    });
  };

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
      if (group && group !== insideGroup) {
        membersOf(group).forEach(member => chosen.add(member));
      }
    }

    return chosen;
  };

  const setSelection = (ids: Iterable<string>): void => {
    const chosen = [...ids];
    if (insideGroup && !chosen.some(id => groupOf(id) === insideGroup)) {
      insideGroup = undefined;
    }

    selection.clear();
    for (const id of widened(chosen)) {
      selection.add(id);
    }

    reportSelection();
    reportPointer(false);
    invalidate();
  };

  const commit = (changes: readonly BoardElement[]): void => {
    const ops = scene.commit(changes);
    if (ops.length) {
      emit({ type: 'commit', ops });
    }

    invalidate();
  };

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
    if (tool !== props.tool) {
      props = { ...props, tool };
      canvas.style.cursor = CURSORS[tool];
      emit({ type: 'tool', tool });
    }
  };

  /** The version this page's draft of an element will be committed at: what the others compare it against. */
  const predicted = (element: BoardElement): BoardElement => ({
    ...element,
    version: (scene.element(element.id)?.version ?? 0) + 1
  });

  function reportPointer(final: boolean): void {
    if (!lastPointer || props.mode !== 'edit') {
      return;
    }

    emit({
      type: 'pointer',
      final,
      message: {
        x: Math.round(lastPointer[0]),
        y: Math.round(lastPointer[1]),
        draft: draft.size && !final ? [...draft.values()].map(predicted) : null,
        selection: [...selection].slice(0, 50)
      }
    });
  }

  function reportEditor(): void {
    const element = editing ? (draft.get(editing) ?? scene.element(editing)) : undefined;
    if (!element) {
      emit({ type: 'editor', editor: undefined });

      return;
    }

    const [left, top] = toScreen(camera, element.x, element.y);
    const sticky = element.type === 'sticky';
    emit({
      type: 'editor',
      editor: {
        id: element.id,
        text: element.text ?? '',
        left,
        top,
        width: sticky ? element.width * camera.zoom : Math.max(element.width, 40) * camera.zoom + 24,
        minHeight: (sticky ? element.height : fontSizeOf(element) * 1.25) * camera.zoom,
        fontSize: fontSizeOf(element) * camera.zoom,
        font: palette.font,
        color: palette.stroke[element.stroke],
        padding: sticky ? STICKY_PADDING * camera.zoom : 0,
        wraps: sticky
      }
    });
  }

  const newElement = (type: ShapeType, [x, y]: Point): BoardElement => {
    const fill: Fill =
      type === 'sticky'
        ? props.fill === 'none'
          ? 'yellow'
          : props.fill
        : isLinear(type) || type === 'text'
          ? 'none'
          : props.fill;

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

  const topmostAt = (point: Point): BoardElement | undefined =>
    displayed()
      .reverse()
      .find(element => hits(element, point, 6 / camera.zoom));

  const handleAt = (screenX: number, screenY: number): Handle | undefined => {
    const box = unionOf(selected().map(boundsOf));
    if (!box || props.tool !== 'select') {
      return undefined;
    }

    return HANDLES.find(handle => {
      const [bx, by] = handlePoint(box, handle);
      const [x, y] = toScreen(camera, bx, by);
      const offsetX = handle === 'nw' || handle === 'sw' ? -6 : 6;
      const offsetY = handle === 'nw' || handle === 'ne' ? -6 : 6;

      return Math.abs(screenX - x - offsetX) <= 8 && Math.abs(screenY - y - offsetY) <= 8;
    });
  };

  const startEditing = (element: BoardElement): void => {
    editing = element.id;
    draft.set(element.id, element);
    reportEditor();
    invalidate();
  };

  /** A text's box is what its lines take: measured once it is typed, so hit testing and the selection fit it. */
  const measured = (element: BoardElement): BoardElement =>
    element.type === 'text' ? { ...element, ...measureText(context, element, palette) } : element;

  const finishEditing = (): void => {
    const id = editing;
    if (!id) {
      return;
    }

    const element = draft.get(id);
    editing = undefined;
    draft.delete(id);
    emit({ type: 'editor', editor: undefined });
    if (!element) {
      invalidate();

      return;
    }

    const saved = scene.element(id);
    const empty = !(element.text ?? '').trim();
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

  const erase = (erased: Set<string>, point: Point): void => {
    for (const element of displayed()) {
      if (!erased.has(element.id) && hits(element, point, 8 / camera.zoom)) {
        erased.add(element.id);
      }
    }
  };

  // ── The pointer ──────────────────────────────────────────────────────────────────────────────────────────────────

  const screenOf = (event: PointerEvent | MouseEvent | WheelEvent): Point => {
    const rect = canvas.getBoundingClientRect();

    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  const startPinch = (): void => {
    const [a, b] = [...pointers.values()];
    gesture = undefined;
    draft.clear();
    pinch = {
      distance: Math.hypot(a[0] - b[0], a[1] - b[1]),
      center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      camera
    };
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (props.mode !== 'edit') {
      return;
    }

    // The canvas decides where focus goes: the browser's default would move it to the page after this handler — out
    // of a text field just opened here — and whatever had it before (the title) is let go, so its blur still saves.
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }

    const screen = screenOf(event);
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, screen);
    if (pointers.size === 2) {
      startPinch();
      invalidate();

      return;
    }

    if (editing) {
      finishEditing();
    }

    const point = toBoard(camera, ...screen);
    lastPointer = point;
    if (event.button === 1 || props.tool === 'hand' || spaceHeld) {
      gesture = { kind: 'pan', start: screen, camera };
      canvas.style.cursor = 'grabbing';

      return;
    }

    if (event.button !== 0) {
      return;
    }

    switch (props.tool) {
      case 'select': {
        const handle = handleAt(...screen);
        const chosen = selected();
        const box = unionOf(chosen.map(boundsOf));
        if (handle && box) {
          gesture = { kind: 'resize', handle, anchor: anchorOf(box, handle), box, originals: chosen };
          break;
        }

        const hit = topmostAt(point);
        if (!hit) {
          const base = new Set(event.shiftKey ? selection : []);
          setSelection(base);
          gesture = { kind: 'marquee', origin: point, current: point, base };
          break;
        }

        if (event.shiftKey) {
          const next = new Set(selection);
          const picked = hit.group && hit.group !== insideGroup ? membersOf(hit.group) : [hit.id];
          const removing = next.has(hit.id);
          picked.forEach(id => (removing ? next.delete(id) : next.add(id)));
          setSelection(next);
          break;
        }

        if (!selection.has(hit.id)) {
          setSelection([hit.id]);
        }

        gesture = { kind: 'move', origin: point, originals: selected() };
        break;
      }
      case 'eraser': {
        const erased = new Set<string>();
        erase(erased, point);
        gesture = { kind: 'erase', erased };
        break;
      }
      case 'text': {
        // Placed so the click lands inside the first line rather than on its top edge.
        const element = newElement('text', point);
        setSelection([]);
        startEditing({ ...element, y: element.y - fontSizeOf(element) * 0.6 });
        switchTool('select');
        break;
      }
      case 'arrow':
      case 'line':
        setSelection([]);
        gesture = { kind: 'linear', origin: point, element: newElement(props.tool, point) };
        break;
      case 'freehand':
        setSelection([]);
        gesture = { kind: 'freehand', element: newElement('freehand', point) };
        break;
      case 'rectangle':
      case 'ellipse':
      case 'diamond':
      case 'sticky':
        setSelection([]);
        gesture = { kind: 'box', origin: point, element: newElement(props.tool, point) };
        break;
    }

    invalidate();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (props.mode !== 'edit') {
      return;
    }

    const screen = screenOf(event);
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, screen);
    }

    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const center: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const zoomed = zoomAt(
        pinch.camera,
        ...pinch.center,
        pinch.camera.zoom * (distance / Math.max(pinch.distance, 1))
      );
      setCamera({
        ...zoomed,
        x: zoomed.x - (center[0] - pinch.center[0]) / zoomed.zoom,
        y: zoomed.y - (center[1] - pinch.center[1]) / zoomed.zoom
      });

      return;
    }

    const point = toBoard(camera, ...screen);
    lastPointer = point;

    if (!gesture) {
      const handle = props.tool === 'select' ? handleAt(...screen) : undefined;
      const over = props.tool === 'select' && !handle ? topmostAt(point) : undefined;
      canvas.style.cursor = spaceHeld ? 'grab' : handle ? HANDLE_CURSORS[handle] : over ? 'move' : CURSORS[props.tool];
      reportPointer(false);

      return;
    }

    switch (gesture.kind) {
      case 'pan': {
        const [startX, startY] = gesture.start;
        setCamera({
          ...gesture.camera,
          x: gesture.camera.x - (screen[0] - startX) / camera.zoom,
          y: gesture.camera.y - (screen[1] - startY) / camera.zoom
        });
        break;
      }
      case 'move': {
        const dx = point[0] - gesture.origin[0];
        const dy = point[1] - gesture.origin[1];
        for (const original of gesture.originals) {
          draft.set(original.id, { ...original, x: original.x + dx, y: original.y + dy });
        }

        break;
      }
      case 'resize': {
        const { anchor, box, handle } = gesture;
        const [cornerX, cornerY] = handlePoint(box, handle);
        let scaleX = (point[0] - anchor[0]) / (cornerX - anchor[0] || 1);
        let scaleY = (point[1] - anchor[1]) / (cornerY - anchor[1] || 1);
        if (event.shiftKey) {
          const uniform = Math.max(Math.abs(scaleX), Math.abs(scaleY));
          scaleX = Math.sign(scaleX || 1) * uniform;
          scaleY = Math.sign(scaleY || 1) * uniform;
        }

        // Never flat: a box scaled to nothing cannot be picked up again.
        scaleX = Math.sign(scaleX || 1) * Math.max(Math.abs(scaleX), 4 / Math.max(box.width, 1));
        scaleY = Math.sign(scaleY || 1) * Math.max(Math.abs(scaleY), 4 / Math.max(box.height, 1));
        for (const original of gesture.originals) {
          draft.set(original.id, scaleElement(original, anchor, scaleX, scaleY));
        }

        break;
      }
      case 'marquee': {
        gesture.current = point;
        const area = boxFrom(gesture.origin, point);
        const inside = displayed()
          .filter(element => contains(area, boundsOf(element)))
          .map(element => element.id);
        setSelection([...gesture.base, ...inside]);
        break;
      }
      case 'box': {
        let [dx, dy] = [point[0] - gesture.origin[0], point[1] - gesture.origin[1]];
        if (event.shiftKey) {
          const side = Math.max(Math.abs(dx), Math.abs(dy));
          dx = Math.sign(dx || 1) * side;
          dy = Math.sign(dy || 1) * side;
        }

        const box = boxFrom(gesture.origin, [gesture.origin[0] + dx, gesture.origin[1] + dy]);
        gesture.element = { ...gesture.element, ...box };
        draft.set(gesture.element.id, gesture.element);
        break;
      }
      case 'linear': {
        const offset: Point = [point[0] - gesture.origin[0], point[1] - gesture.origin[1]];
        const end = event.shiftKey ? snapAngle(offset) : offset;
        gesture.element = {
          ...gesture.element,
          points: [[0, 0], end],
          width: Math.abs(end[0]),
          height: Math.abs(end[1])
        };
        draft.set(gesture.element.id, gesture.element);
        break;
      }
      case 'freehand': {
        const points = gesture.element.points ?? [];
        const last = points[points.length - 1];
        const next: Point = [point[0] - gesture.element.x, point[1] - gesture.element.y];
        if (!last || Math.hypot(next[0] - last[0], next[1] - last[1]) > 0.5 / camera.zoom) {
          gesture.element = { ...gesture.element, points: [...points, next] };
          draft.set(gesture.element.id, gesture.element);
        }

        break;
      }
      case 'erase':
        erase(gesture.erased, point);
        break;
    }

    reportPointer(false);
    invalidate();
  };

  const endGesture = (cancelled: boolean): void => {
    const ended = gesture;
    gesture = undefined;
    const drafted = [...draft.values()];
    if (!editing) {
      draft.clear();
    }

    canvas.style.cursor = CURSORS[props.tool];
    if (!ended || cancelled) {
      reportPointer(true);
      invalidate();

      return;
    }

    switch (ended.kind) {
      case 'move':
      case 'resize': {
        const moved = drafted.filter(element => {
          const original = scene.element(element.id);

          return (
            original &&
            (original.x !== element.x ||
              original.y !== element.y ||
              original.width !== element.width ||
              original.height !== element.height)
          );
        });
        commit(moved);
        break;
      }
      case 'box': {
        const { element } = ended;
        const tiny = element.width * camera.zoom < 4 && element.height * camera.zoom < 4;
        const size = DEFAULT_BOX[element.type === 'sticky' ? 'sticky' : 'shape'];
        const placed = tiny
          ? { ...element, x: ended.origin[0] - size.width / 2, y: ended.origin[1] - size.height / 2, ...size }
          : element;
        commit([placed]);
        setSelection([placed.id]);
        switchTool('select');
        if (placed.type === 'sticky') {
          startEditing(scene.element(placed.id) ?? placed);
        }

        break;
      }
      case 'linear': {
        const end = ended.element.points?.[1];
        if (end && Math.hypot(end[0], end[1]) * camera.zoom >= 4) {
          commit([ended.element]);
          setSelection([ended.element.id]);
          switchTool('select');
        }

        break;
      }
      case 'freehand': {
        // Exactly the points that were drawn: the stroke on release is the one on screen a moment before.
        const points = capPoints(ended.element.points ?? [], LIMITS.points);
        const stroke = points.length > 1 ? points : [[0, 0] as Point, [0.5, 0.5] as Point];
        const xs = stroke.map(([px]) => px);
        const ys = stroke.map(([, py]) => py);
        commit([
          {
            ...ended.element,
            points: stroke,
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
          }
        ]);
        break;
      }
      case 'erase': {
        const erased = [...ended.erased]
          .map(id => scene.element(id))
          .filter((element): element is BoardElement => element !== undefined && !element.deleted)
          .map(element => ({ ...element, deleted: true }));
        commit(erased);
        setSelection([...selection].filter(id => !ended.erased.has(id)));
        break;
      }
      case 'pan':
      case 'marquee':
        break;
    }

    reportPointer(true);
    invalidate();
  };

  const onPointerUp = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    if (pinch) {
      if (pointers.size < 2) {
        pinch = undefined;
      }

      return;
    }

    endGesture(event.type === 'pointercancel');
  };

  const onDoubleClick = (event: MouseEvent): void => {
    if (props.mode !== 'edit' || props.tool !== 'select') {
      return;
    }

    const point = toBoard(camera, ...screenOf(event));
    const hit = topmostAt(point);
    // Into a group: the member under the pointer, alone. A second double-click on a text in it edits the text.
    if (hit?.group && hit.group !== insideGroup) {
      insideGroup = hit.group;
      setSelection([hit.id]);

      return;
    }

    if (hit && holdsText(hit.type)) {
      startEditing(hit);

      return;
    }

    if (!hit) {
      setSelection([]);
      startEditing(newElement('text', [point[0], point[1] - 16]));
    }
  };

  const onWheel = (event: WheelEvent): void => {
    if (props.mode !== 'edit') {
      return;
    }

    event.preventDefault();
    const scale = event.deltaMode === 1 ? 16 : 1;
    const [screenX, screenY] = screenOf(event);
    if (event.ctrlKey || event.metaKey) {
      setCamera(zoomAt(camera, screenX, screenY, camera.zoom * Math.exp((-event.deltaY * scale) / 300)));

      return;
    }

    const dx = (event.shiftKey ? event.deltaY : event.deltaX) * scale;
    const dy = (event.shiftKey ? 0 : event.deltaY) * scale;
    setCamera({ ...camera, x: camera.x + dx / camera.zoom, y: camera.y + dy / camera.zoom });
  };

  const typing = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space' && !typing(event.target) && props.mode === 'edit') {
      event.preventDefault();
      if (!spaceHeld) {
        spaceHeld = true;
        canvas.style.cursor = 'grab';
      }
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space') {
      spaceHeld = false;
      canvas.style.cursor = CURSORS[props.tool];
    }
  };

  const onPointerLeave = (): void => {
    if (!gesture) {
      lastPointer = undefined;
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('dblclick', onDoubleClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const resizeObserver = new ResizeObserver(() => {
    const rect = host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    size = { width: rect.width, height: rect.height, dpr };
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    if (fitPending && rect.width && rect.height) {
      fitPending = false;
      fit();
    }

    invalidate();
  });
  resizeObserver.observe(host);

  // ── What the page asks of it ─────────────────────────────────────────────────────────────────────────────────────

  const zoomBy = (factor: number): void =>
    setCamera(zoomAt(camera, size.width / 2, size.height / 2, camera.zoom * factor));

  const restyle = ({
    stroke,
    fill,
    strokeWidth
  }: {
    stroke?: unknown;
    fill?: unknown;
    strokeWidth?: unknown;
  }): void => {
    const width = Number(strokeWidth);
    const chosen = selected();
    const changes = chosen.map(element => {
      let next = element;
      if (isOneOf(STROKES, stroke)) {
        next = { ...next, stroke };
      }

      if (
        isOneOf(FILLS, fill) &&
        !isLinear(element.type) &&
        element.type !== 'text' &&
        !(element.type === 'sticky' && fill === 'none')
      ) {
        next = { ...next, fill };
      }

      if (isOneOf(STROKE_WIDTHS, width)) {
        next = measured({ ...next, strokeWidth: width });
      }

      return next;
    });
    commit(changes.filter((next, index) => next !== chosen[index]));
    reportSelection();
  };

  const restack = (toFront: boolean): void => {
    const chosen = selected().sort(byZ);
    const start = toFront ? scene.topZ + 1 : scene.bottomZ - chosen.length;
    commit(chosen.map((element, index) => ({ ...element, z: start + index })));
  };

  const exportPng = (): void => {
    const elements = scene.visible();
    const box = unionOf(elements.map(boundsOf));
    if (!box) {
      return;
    }

    const margin = 32;
    const scale = Math.min(2, Math.sqrt(16_000_000 / ((box.width + margin * 2) * (box.height + margin * 2))));
    const image = document.createElement('canvas');
    image.width = Math.ceil((box.width + margin * 2) * scale);
    image.height = Math.ceil((box.height + margin * 2) * scale);
    const imageContext = image.getContext('2d');
    if (!imageContext) {
      return;
    }

    imageContext.fillStyle = palette.paper;
    imageContext.fillRect(0, 0, image.width, image.height);
    imageContext.setTransform(scale, 0, 0, scale, (margin - box.x) * scale, (margin - box.y) * scale);
    const imageRenderer = createRenderer(image);
    elements.forEach(element => imageRenderer.drawElement(imageContext, element, palette));
    image.toBlob(blob => {
      if (!blob) {
        return;
      }

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${(props.title || 'board').replace(/[^\w\- ]+/g, '').trim() || 'board'}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
  };

  /** Only while nobody types: ⌘Z in a text field is the field's own undo. */
  const unlessEditing = (action: () => void) => (): void => {
    if (!editing) {
      action();
    }
  };

  return {
    setProps: (next: ControllerProps): void => {
      const toolChanged = next.tool !== props.tool;
      props = next;
      canvas.style.cursor = CURSORS[next.tool];
      if (toolChanged && next.tool !== 'select') {
        setSelection([]);
      }

      invalidate();
    },

    /** The scheme changed: every colour is read again, and every drawing made in the old ones is stale. */
    repaint: (): void => {
      palette = readPalette(host);
      reportEditor();
      invalidate();
    },

    /** The board as the server holds it. Another board starts over; the same board is merged into. */
    load: (id: string, elements: readonly unknown[]): void => {
      const parsed = elements.map(parseElement).filter((element): element is BoardElement => element !== undefined);
      if (id !== boardId) {
        boardId = id;
        scene.reset(parsed);
        selection.clear();
        draft.clear();
        remotes.clear();
        editing = undefined;
        fitPending = !size.width;
        if (size.width) {
          fit();
        }
      } else {
        scene.confirm(parsed);
        if (props.mode === 'view') {
          fit();
        }
      }

      invalidate();
    },

    /** The server's announcement of a commit — anyone's, this page's included. */
    confirm: (elements: unknown): void => {
      if (!Array.isArray(elements)) {
        return;
      }

      scene.confirm(elements.map(parseElement).filter((element): element is BoardElement => element !== undefined));
      invalidate();
    },

    remotePointer: (from: string, data: unknown): void => {
      if (typeof data !== 'object' || data === null) {
        return;
      }

      const remote = remotes.get(from) ?? { heardAt: 0, draft: new Map<string, BoardElement>(), selection: [] };
      remotes.set(from, remote);
      remote.heardAt = Date.now();
      if ('x' in data && 'y' in data && isPoint([data.x, data.y])) {
        remote.cursor = [Number(data.x), Number(data.y)];
      }

      if ('selection' in data && Array.isArray(data.selection)) {
        remote.selection = data.selection.filter((id): id is string => typeof id === 'string').slice(0, 50);
      }

      if ('draft' in data && Array.isArray(data.draft)) {
        remote.draft = new Map(
          data.draft
            .slice(0, 100)
            .map(parseElement)
            .filter((element): element is BoardElement => element !== undefined)
            .map(element => [element.id, element])
        );
        remote.draftEndedAt = undefined;
      } else if (remote.draft.size && remote.draftEndedAt === undefined) {
        remote.draftEndedAt = Date.now();
        setTimeout(invalidate, REMOTE_DRAFT_GRACE_MS + 50);
      }

      invalidate();
    },

    setMembers: (next: Map<string, Collaborator>): void => {
      members = next;
      for (const from of remotes.keys()) {
        if (!members.has(from)) {
          remotes.delete(from);
        }
      }

      invalidate();
    },

    /** What is being typed, as it is typed — drawn nowhere but the field, and sent to the room as a draft. */
    typeText: (text: string): void => {
      const element = editing ? draft.get(editing) : undefined;
      if (element) {
        draft.set(element.id, measured({ ...element, text }));
        reportPointer(false);
        reportEditor();
      }
    },

    finishEditing,
    undo: unlessEditing(() => send(scene.undo())),
    redo: unlessEditing(() => send(scene.redo())),
    deleteSelection: unlessEditing(() => {
      commit(selected().map(element => ({ ...element, deleted: true })));
      setSelection([]);
    }),
    selectAll: unlessEditing(() => setSelection(scene.visible().map(element => element.id))),
    duplicate: unlessEditing(() => {
      const top = scene.topZ;
      // A copy of a group is a group of its own: the copies must not be picked up with the originals.
      const groups = new Map<string, string>();
      const copies = selected()
        .sort(byZ)
        .map((element, index) => {
          const group = element.group === undefined ? undefined : (groups.get(element.group) ?? newId());
          if (element.group !== undefined && group !== undefined) {
            groups.set(element.group, group);
          }

          return {
            ...element,
            id: newId(),
            x: element.x + 16,
            y: element.y + 16,
            z: top + 1 + index,
            version: 0,
            ...(group === undefined ? {} : { group })
          };
        });
      commit(copies);
      setSelection(copies.map(element => element.id));
    }),
    /** One group of everything selected — groups inside it included: there is one level. */
    group: unlessEditing(() => {
      const chosen = selected();
      if (chosen.length < 2) {
        return;
      }

      const group = newId();
      insideGroup = undefined;
      commit(chosen.map(element => ({ ...element, group })));
      reportSelection();
    }),
    ungroup: unlessEditing(() => {
      insideGroup = undefined;
      // `group` is left out of each element — present with `undefined` in it, it would still be sent as a key.
      commit(
        selected()
          .filter(element => element.group !== undefined)
          .map(({ group, ...element }) => element)
      );
      reportSelection();
    }),
    deselect: (): void => {
      finishEditing();
      setSelection([]);
    },
    bringToFront: unlessEditing(() => restack(true)),
    sendToBack: unlessEditing(() => restack(false)),
    applyStyle: restyle,
    zoomIn: (): void => zoomBy(1.25),
    zoomOut: (): void => zoomBy(1 / 1.25),
    zoomReset: (): void => setCamera(zoomAt(camera, size.width / 2, size.height / 2, 1)),
    zoomToFit: fit,
    exportPng,
    rollback: (): void => {
      scene.rollback();
      draft.clear();
      editing = undefined;
      emit({ type: 'editor', editor: undefined });
      setSelection([...selection].filter(id => !(scene.element(id)?.deleted ?? true)));
    },
    destroy: (): void => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('dblclick', onDoubleClick);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    }
  };
};

export type BoardController = ReturnType<typeof createBoardController>;
