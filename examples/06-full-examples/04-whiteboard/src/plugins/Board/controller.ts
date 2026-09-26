import {
  ANCHORS,
  FILLS,
  LIMITS,
  STROKES,
  STROKE_WIDTHS,
  holdsText,
  isConnectable,
  isConnector,
  isLinear,
  parseElement,
  takesLabel
} from '../../board/model.ts';
import { isReaction } from '../../board/reactions.ts';
import {
  drawCursor,
  drawDots,
  drawHandles,
  drawMarquee,
  drawOutline,
  drawPoints,
  fontSizeOf,
  LABEL_PADDING,
  layoutText,
  measureText,
  STACK_STRIP,
  STICKY_PADDING,
  STICKY_SIZE,
  voteBadgeBox,
  createRenderer
} from './draw.ts';
import { createEffects } from './effects.ts';
import {
  anchorOf,
  anchorPoint,
  beyondAnchor,
  boundsOf,
  boxFrom,
  capPoints,
  clampZoom,
  contains,
  detachEnd,
  fitCamera,
  handlePoint,
  HANDLES,
  hits,
  resolveConnector,
  scaleElement,
  isDeepInside,
  nearestAnchor,
  snapToAnchor,
  snapAngle,
  toBoard,
  toScreen,
  unionOf,
  zoomAt
} from './geometry.ts';
import { readPalette } from './palette.ts';
import { createPictures, pictureIn, readPicture } from './pictures.ts';
import { createScene } from './scene.ts';

import type { Box, Camera, Handle } from './geometry.ts';
import type { Palette } from './palette.ts';
import type { Binding, BoardElement, Fill, Point, ShapeType, Stroke, StrokeWidth } from '../../board/model.ts';
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
  'eraser',
  'laser'
] as const;

export type Tool = (typeof TOOLS)[number];

export type ControllerProps = {
  tool: Tool;
  stroke: Stroke;
  fill: Fill;
  strokeWidth: StrokeWidth;
  mode: 'edit' | 'view';
  title: string;
  /** Where the board's pictures are served from: `/board-assets/<board>`. */
  assetBase: string;
  /** The id this visitor keeps, which their votes are counted by. */
  voter: string;
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
  /** A shape's label is centred in it, both ways; everything else starts at the top left. */
  align: 'left' | 'center';
  paddingTop: number;
};

/** Where the selection is on screen, for the tools the component lays beside it. */
export type ScreenBox = { left: number; top: number; width: number; height: number };

/** What this page says to the room while its pointer moves: where it is, what it is dragging, what it selected. */
export type PointerMessage = {
  /** Where the pointer is — absent while it is off the canvas, when only the view changed. */
  x?: number;
  y?: number;
  draft: BoardElement[] | null;
  selection: string[];
  /** What this page is looking at, as a board box — what a follower's view is set to. */
  view: [number, number, number, number];
  /** The pointer is a laser right now: the others draw its trail. */
  laser?: boolean;
  /** What this person is saying at their cursor — `''` once they closed it. */
  chat?: string;
};

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
  | { type: 'pointer'; message: PointerMessage; final: boolean }
  /** Who this page follows now — their name, or `''` once it stopped. */
  | { type: 'follow'; name: string }
  /** A reaction this person sent, for the room. */
  | { type: 'reaction'; reaction: { emoji: string; x: number; y: number } }
  /** A picture pasted or dropped, shown already, for the page to upload: `id` is the element waiting for it. */
  | { type: 'image'; id: string; data: string }
  /** A vote asked for — a click on an element's badge, or the selection's vote button. */
  | { type: 'vote'; id: string }
  /** The chat field at the cursor: open (where, on screen), or closed. */
  | { type: 'chat'; at: { left: number; top: number } | undefined }
  /** Everyone asked to come and look where this person looks. */
  | { type: 'summon'; view: [number, number, number, number] }
  /** Somebody brought everyone to their view — this page included. */
  | { type: 'summoned'; name: string };

type Gesture =
  | { kind: 'pan'; start: Point; camera: Camera }
  | { kind: 'move'; origin: Point; originals: BoardElement[] }
  | { kind: 'resize'; handle: Handle; anchor: Point; box: Box; originals: BoardElement[] }
  | { kind: 'marquee'; origin: Point; current: Point; base: Set<string> }
  | { kind: 'box'; origin: Point; element: BoardElement }
  /**
   * A connector being drawn. `facing` is the shape it was started INSIDE: its anchor is not chosen yet — it is the
   * side facing wherever the other end is, and follows it until the pointer is let go.
   */
  | { kind: 'linear'; origin: Point; element: BoardElement; facing?: string }
  | { kind: 'freehand'; element: BoardElement }
  | { kind: 'erase'; erased: Set<string> }
  /** One end of the selected connector, dragged to a new place — or to another element's anchor. */
  | { kind: 'endpoint'; which: 'start' | 'end'; element: BoardElement }
  | { kind: 'laser' }
  /** A fresh note being drawn off a pile: it follows the pointer once it has moved; a click selects the pile. */
  | { kind: 'peel'; stack: BoardElement; origin: Point; moved: boolean; element: BoardElement };

type Remote = {
  cursor?: Point;
  heardAt: number;
  draft: Map<string, BoardElement>;
  /** When the member's drag ended: its draft is drawn until the server's answer catches up, or this long after. */
  draftEndedAt?: number;
  selection: string[];
  /** What the member is looking at, for following them. */
  view?: [number, number, number, number];
  /** What they are saying at their cursor, and when they stopped — it lingers a moment after. */
  chat?: string;
  chatEndedAt?: number;
};

/** How long cursor chat stays on another screen once its writer closed it. */
const CHAT_LINGER_MS = 3500;

const REMOTE_DRAFT_GRACE_MS = 1500;

/** How far off a shape's edge its connection points sit, and how close a pointer must come to grab one — in pixels. */
const CONNECT_OFFSET = 14;

const GRAB_RADIUS = 9;

/** How far past a shape's box a connector's end still snaps to it — in pixels. */
const SNAP_REACH = 18;

/** How far a sticky must be dragged off its pad before letting go places it — less is a click, which carries it. */
const CARRY_DRAG = 8;

/** A cursor nobody has moved for this long is somebody who walked away: it stops being drawn. */
const CURSOR_IDLE_MS = 60_000;

const DEFAULT_BOX: Record<'sticky' | 'shape', { width: number; height: number }> = {
  sticky: { width: STICKY_SIZE, height: STICKY_SIZE },
  shape: { width: 140, height: 90 }
};

/** A pile on the board: a note's size, with its strip below and the notes under it showing. */
const STACK_BOX = { width: 222, height: 252 };

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const newId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');

const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);

const byZ = (a: BoardElement, b: BoardElement): number => a.z - b.z || (a.id < b.id ? -1 : 1);

const isOneOf = <T extends string | number>(values: readonly T[], value: unknown): value is T =>
  values.some(entry => entry === value);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

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
  eraser: 'cell',
  laser: 'crosshair'
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
  const context2d = canvas.getContext('2d');
  if (!context2d) {
    throw new Error('This browser cannot draw on a canvas');
  }

  // Named once narrowed: the functions below are declarations, which a narrowing does not reach.
  const context: CanvasRenderingContext2D = context2d;

  const renderer = createRenderer(canvas);
  const scene = createScene();
  const selection = new Set<string>();
  /** This person's gesture, drawn over the scene until it ends and is committed. */
  const draft = new Map<string, BoardElement>();
  const remotes = new Map<string, Remote>();
  const pointers = new Map<number, Point>();
  let members = new Map<string, Collaborator>();
  let props: ControllerProps = {
    tool: 'select',
    stroke: 'ink',
    fill: 'none',
    strokeWidth: 2,
    mode: 'edit',
    title: '',
    assetBase: '',
    voter: ''
  };
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
  const effects = createEffects();
  /** The shape under the pointer, whose connection points show. */
  let hovered: string | undefined;
  /** The anchor a connector being drawn will fix to if let go now. */
  let snapping: Binding | undefined;
  /** A sticky taken off the pad, following the pointer until it is put down. */
  let carrying: { element: BoardElement; from?: Point; moved: boolean; over: boolean } | undefined;
  /** The member whose view this page follows. */
  let following: string | undefined;
  const pictures = createPictures(() => invalidate());
  /** What this person is typing at their cursor, while the chat field is open. */
  let chatting: string | undefined;

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

  const endsOf = (element: BoardElement): { start: Point; end: Point } => {
    const points = element.points ?? [[0, 0]];
    const [sx, sy] = points[0];
    const [ex, ey] = points[points.length - 1];

    return { start: [element.x + sx, element.y + sy], end: [element.x + ex, element.y + ey] };
  };

  /** The anchor a point snaps to — on the topmost element near it, never on `exclude` or on a line. */
  const snapAt = (point: Point, exclude?: string, toward?: Point): Binding | undefined => {
    const reach = SNAP_REACH / camera.zoom;
    for (const element of displayed().reverse()) {
      if (element.id === exclude || !isConnectable(element.type)) {
        continue;
      }

      const binding = snapToAnchor(element, point, reach, toward);
      if (binding) {
        return binding;
      }
    }

    return undefined;
  };

  /**
   * A connector from `from` to `to`, fixed at whichever ends are bound. Written with its raw points; `displayed` bends
   * it into its curve.
   */
  const connectorBetween = (
    element: BoardElement,
    from: Point,
    to: Point,
    start: Binding | undefined,
    end: Binding | undefined
  ): BoardElement => {
    const { start: _start, end: _end, ...rest } = element;
    const offset: Point = [to[0] - from[0], to[1] - from[1]];

    return {
      ...rest,
      x: from[0],
      y: from[1],
      points: [[0, 0], offset],
      width: Math.abs(offset[0]),
      height: Math.abs(offset[1]),
      ...(start ? { start } : {}),
      ...(end ? { end } : {})
    };
  };

  /**
   * Connectors let go of every element not among `kept`: a connector moved on its own stays where it was put, rather
   * than being stretched back to the shapes it was fixed to.
   */
  const detachOutside = (element: BoardElement, kept: ReadonlySet<string>): BoardElement => {
    if (!isConnector(element.type)) {
      return element;
    }

    let next = element;
    if (next.start && !kept.has(next.start.id)) {
      next = detachEnd(next, 'start');
    }

    if (next.end && !kept.has(next.end.id)) {
      next = detachEnd(next, 'end');
    }

    return next;
  };

  /** The connectors fixed to any of `removed` that are not removed with them: let go, where they are drawn now. */
  const releasedFrom = (removed: ReadonlySet<string>): BoardElement[] => {
    const shown = displayed();
    const kept = new Set(shown.map(element => element.id).filter(id => !removed.has(id)));

    return shown
      .filter(
        element =>
          isConnector(element.type) &&
          !removed.has(element.id) &&
          ((element.start && removed.has(element.start.id)) || (element.end && removed.has(element.end.id)))
      )
      .map(element => detachOutside(element, kept));
  };

  /** The end of the sole selected connector under a screen point, if one is. */
  const endpointAt = (screenX: number, screenY: number): 'start' | 'end' | undefined => {
    const connector = props.tool === 'select' ? soleConnector() : undefined;
    if (!connector) {
      return undefined;
    }

    const ends = endsOf(connector);

    return (['start', 'end'] as const).find(which => {
      const [x, y] = toScreen(camera, ...ends[which]);

      return Math.hypot(screenX - x, screenY - y) <= GRAB_RADIUS;
    });
  };

  /** The connection point of the hovered shape under a screen point: where a connector drawn from here starts. */
  const connectionAt = (screenX: number, screenY: number): Binding | undefined => {
    const target = props.tool === 'select' && hovered ? current().get(hovered) : undefined;
    if (!target || !isConnectable(target.type)) {
      return undefined;
    }

    const anchor = ANCHORS.find(candidate => {
      const [x, y] = toScreen(camera, ...beyondAnchor(target, candidate, CONNECT_OFFSET / camera.zoom));

      return Math.hypot(screenX - x, screenY - y) <= GRAB_RADIUS;
    });

    return anchor ? { id: target.id, anchor } : undefined;
  };

  /**
   * The shape whose connection points show: the topmost one within reach of the pointer — past its edge, so the
   * points just outside it can be reached without them vanishing on the way.
   */
  const hoveredAt = (point: Point): string | undefined => {
    const reach = (CONNECT_OFFSET + GRAB_RADIUS) / camera.zoom;

    return displayed()
      .reverse()
      .find(element => {
        if (!isConnectable(element.type) || element.id === editing) {
          return false;
        }

        const box = boundsOf(element);

        return (
          point[0] >= box.x - reach &&
          point[0] <= box.x + box.width + reach &&
          point[1] >= box.y - reach &&
          point[1] <= box.y + box.height + reach
        );
      })?.id;
  };

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
          faded: erased?.has(element.id) ?? false,
          voter: props.voter,
          ...(element.type === 'image' ? { picture: pictures.of(element, props.assetBase) } : {})
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
    const connector = soleConnector();
    if (connector && props.tool === 'select' && !editing) {
      const { start, end } = endsOf(connector);
      drawPoints(context, camera, [start, end], palette.accent);
    } else if (box && props.tool === 'select' && !editing && (!gesture || gesture.kind === 'resize')) {
      drawHandles(context, camera, box, palette.accent);
    }

    // Where a connector can start from, on the shape under the pointer — and where one being drawn will land.
    const target = snapping
      ? byId.get(snapping.id)
      : !gesture && !editing && !carrying && props.tool === 'select' && hovered
        ? byId.get(hovered)
        : undefined;
    if (target && isConnectable(target.type)) {
      const drawing = gesture?.kind === 'linear' || gesture?.kind === 'endpoint';
      const points = ANCHORS.map(anchor =>
        drawing ? anchorPoint(target, anchor) : beyondAnchor(target, anchor, CONNECT_OFFSET / camera.zoom)
      );
      drawPoints(context, camera, points, palette.accent, snapping ? anchorPoint(target, snapping.anchor) : undefined);
    }

    // A laser trail and a reaction fade on their own clock: keep drawing while any is left.
    if (effects.draw(context, camera, key => (key === 'me' ? palette.laser : colourOf(key)), now)) {
      invalidate();
    }

    if (gesture?.kind === 'marquee') {
      drawMarquee(context, camera, boxFrom(gesture.origin, gesture.current), palette.accent);
    }

    for (const [from, remote] of remotes) {
      const member = members.get(from);
      if (remote.cursor && member && now - remote.heardAt < CURSOR_IDLE_MS) {
        const saying =
          remote.chat && (remote.chatEndedAt === undefined || now - remote.chatEndedAt < CHAT_LINGER_MS)
            ? remote.chat
            : undefined;
        drawCursor(context, camera, remote.cursor, member.name, colourOf(from), palette.ui, saying);
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
    // A follower's view is set from this, as it changes — not only when the pointer moves.
    reportPointer(false);
    invalidate();
  };

  const stopFollowing = (): void => {
    if (following) {
      following = undefined;
      emit({ type: 'follow', name: '' });
    }
  };

  /** Shows what a followed member shows: the same middle, at the zoom that fits their view in this one. */
  const showView = ([x, y, width, height]: [number, number, number, number]): void => {
    const zoom = clampZoom(Math.min(size.width / Math.max(width, 1), size.height / Math.max(height, 1)));
    setCamera({ x: x + width / 2 - size.width / 2 / zoom, y: y + height / 2 - size.height / 2 / zoom, zoom });
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
    if (props.mode !== 'edit') {
      return;
    }

    const view = viewport();
    emit({
      type: 'pointer',
      final,
      message: {
        ...(lastPointer ? { x: Math.round(lastPointer[0]), y: Math.round(lastPointer[1]) } : {}),
        draft: draft.size && !final ? [...draft.values()].map(predicted) : null,
        selection: [...selection].slice(0, 50),
        view: [Math.round(view.x), Math.round(view.y), Math.round(view.width), Math.round(view.height)],
        ...(gesture?.kind === 'laser' ? { laser: true } : {}),
        ...(chatting === undefined ? {} : { chat: chatting })
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
    const label = takesLabel(element.type);
    const common = {
      id: element.id,
      text: element.text ?? '',
      left,
      top,
      fontSize: fontSizeOf(element) * camera.zoom,
      font: palette.font,
      color: palette.stroke[element.stroke]
    };
    if (label) {
      // Typed where it will be drawn: centred, and lowered to the middle as its lines are.
      const { lines, lineHeight } = layoutText(context, element, palette);
      emit({
        type: 'editor',
        editor: {
          ...common,
          width: element.width * camera.zoom,
          minHeight: element.height * camera.zoom,
          padding: LABEL_PADDING * camera.zoom,
          paddingTop: Math.max(0, (element.height - Math.max(1, lines.length) * lineHeight) / 2) * camera.zoom,
          wraps: true,
          align: 'center'
        }
      });

      return;
    }

    emit({
      type: 'editor',
      editor: {
        ...common,
        width: sticky ? element.width * camera.zoom : Math.max(element.width, 40) * camera.zoom + 24,
        minHeight: (sticky ? element.height : fontSizeOf(element) * 1.25) * camera.zoom,
        padding: sticky ? STICKY_PADDING * camera.zoom : 0,
        paddingTop: sticky ? STICKY_PADDING * camera.zoom : 0,
        wraps: sticky,
        align: 'left'
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

  /** The element whose vote badge is under a point — only elements with votes show one. */
  const voteAt = (point: Point): string | undefined =>
    displayed()
      .reverse()
      .find(element => {
        if (!element.votes?.length) {
          return false;
        }

        const box = voteBadgeBox(element);

        return (
          point[0] >= box.x && point[0] <= box.x + box.width && point[1] >= box.y && point[1] <= box.y + box.height
        );
      })?.id;

  /** The topmost shape a point is inside — its whole area, not just its outline or its fill. */
  const shapeAround = (point: Point): BoardElement | undefined =>
    displayed()
      .reverse()
      .find(
        element =>
          takesLabel(element.type) &&
          hits({ ...element, fill: element.fill === 'none' ? 'red' : element.fill }, point, 0)
      );

  const handleAt = (screenX: number, screenY: number): Handle | undefined => {
    const box = unionOf(selected().map(boundsOf));
    // A lone connector is resized by its ends, not by its box.
    if (!box || props.tool !== 'select' || soleConnector()) {
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
    // Touching the board takes it back: a follower who reaches for it stops following.
    stopFollowing();
    if (carrying) {
      putDown(toBoard(camera, ...screen));

      return;
    }

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
        // A vote badge is a button on the element: a click on it votes, and moves nothing.
        const badge = voteAt(point);
        if (badge) {
          emit({ type: 'vote', id: badge });
          break;
        }

        // A pile gives a note to whoever drags from its paper; its strip moves the pile itself.
        const pile = event.shiftKey ? undefined : topmostAt(point);
        if (pile?.type === 'stack' && point[1] < pile.y + pile.height - STACK_STRIP) {
          const note: BoardElement = { ...newElement('sticky', point), ...DEFAULT_BOX.sticky, fill: pile.fill };
          gesture = { kind: 'peel', stack: pile, origin: point, moved: false, element: note };
          break;
        }

        const end = endpointAt(...screen);
        const connector = soleConnector();
        if (end && connector) {
          gesture = { kind: 'endpoint', which: end, element: connector };
          break;
        }

        // From a shape's connection point: an arrow already fixed at this end.
        const from = connectionAt(...screen);
        if (from) {
          const origin = anchorPoint(current().get(from.id) ?? newElement('arrow', point), from.anchor);
          setSelection([]);
          gesture = { kind: 'linear', origin, element: { ...newElement('arrow', origin), start: from } };
          break;
        }

        const handle = handleAt(...screen);
        const chosen = selected();
        const box = unionOf(chosen.map(boundsOf));
        if (handle && box) {
          const ids = new Set(chosen.map(element => element.id));
          gesture = {
            kind: 'resize',
            handle,
            anchor: anchorOf(box, handle),
            box,
            originals: chosen.map(element => detachOutside(element, ids))
          };
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

        // A connector moved without the shapes it is fixed to lets go of them, and stays where it is put.
        const moving = selected();
        const ids = new Set(moving.map(element => element.id));
        gesture = { kind: 'move', origin: point, originals: moving.map(element => detachOutside(element, ids)) };
        break;
      }
      case 'laser':
        gesture = { kind: 'laser' };
        effects.trail('me', point);
        break;
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
      case 'line': {
        // Started on a shape: fixed to its nearest anchor from the first moment.
        setSelection([]);
        const start = snapAt(point);
        const target = start ? current().get(start.id) : undefined;
        const origin = start && target ? anchorPoint(target, start.anchor) : point;
        const element = newElement(props.tool, origin);
        const facing = start && target && isDeepInside(target, point, SNAP_REACH / camera.zoom) ? start.id : undefined;
        gesture = {
          kind: 'linear',
          origin,
          element: start ? { ...element, start } : element,
          ...(facing ? { facing } : {})
        };
        break;
      }
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
      stopFollowing();
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
      const shown = props.tool === 'select' ? hoveredAt(point) : undefined;
      if (shown !== hovered) {
        hovered = shown;
        invalidate();
      }

      const handle = props.tool === 'select' ? handleAt(...screen) : undefined;
      const grab = props.tool === 'select' && (endpointAt(...screen) ?? connectionAt(...screen));
      const over = props.tool === 'select' && !handle ? topmostAt(point) : undefined;
      canvas.style.cursor = spaceHeld
        ? 'grab'
        : handle
          ? HANDLE_CURSORS[handle]
          : grab
            ? 'crosshair'
            : over
              ? 'move'
              : CURSORS[props.tool];
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
        // Over another shape, the end snaps to its nearest anchor — or, deep inside it, to the side facing the start.
        // Shift holds the angle to 15° steps instead.
        const shown = current();
        const startTarget = gesture.facing ? shown.get(gesture.facing) : undefined;
        snapping = event.shiftKey ? undefined : snapAt(point, gesture.element.start?.id, gesture.origin);
        if (startTarget && gesture.element.start) {
          // Started inside a shape: its side is the one facing where this end is now.
          const endTarget = snapping ? shown.get(snapping.id) : undefined;
          const aim = endTarget && snapping ? anchorPoint(endTarget, snapping.anchor) : point;
          const anchor = nearestAnchor(startTarget, aim);
          gesture.element = { ...gesture.element, start: { id: startTarget.id, anchor } };
          gesture.origin = anchorPoint(startTarget, anchor);
        }

        const offset: Point = [point[0] - gesture.origin[0], point[1] - gesture.origin[1]];
        const [dx, dy] = event.shiftKey ? snapAngle(offset) : offset;
        gesture.element = connectorBetween(
          gesture.element,
          gesture.origin,
          [gesture.origin[0] + dx, gesture.origin[1] + dy],
          gesture.element.start,
          snapping
        );
        draft.set(gesture.element.id, gesture.element);
        break;
      }
      case 'endpoint': {
        const { element, which } = gesture;
        const ends = endsOf(element);
        const other = which === 'start' ? element.end : element.start;
        snapping = snapAt(point, other?.id);
        const moved =
          which === 'start'
            ? connectorBetween(element, point, ends.end, snapping, element.end)
            : connectorBetween(element, ends.start, point, element.start, snapping);
        draft.set(element.id, moved);
        break;
      }
      case 'laser':
        effects.trail('me', point);
        break;
      case 'peel': {
        gesture.moved ||= Math.hypot(point[0] - gesture.origin[0], point[1] - gesture.origin[1]) * camera.zoom > 4;
        if (gesture.moved) {
          const { width, height } = gesture.element;
          gesture.element = {
            ...gesture.element,
            x: point[0] - width / 2,
            y: point[1] - height / 2,
            z: scene.topZ + 1
          };
          draft.set(gesture.element.id, gesture.element);
        }

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
    snapping = undefined;
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
        // Kept as it is drawn — its curve baked into its points — and fixed at whichever ends found an anchor.
        const drawn = drafted.find(element => element.id === ended.element.id) ?? ended.element;
        const shown = current().get(drawn.id) ?? drawn;
        const { start, end } = endsOf(shown);
        if (Math.hypot(end[0] - start[0], end[1] - start[1]) * camera.zoom >= 4) {
          commit([resolveConnector(drawn, id => current().get(id))]);
          setSelection([drawn.id]);
          switchTool('select');
        }

        break;
      }
      case 'endpoint': {
        const moved = drafted.find(element => element.id === ended.element.id);
        if (moved) {
          commit([resolveConnector(moved, id => current().get(id))]);
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
        commit([...erased, ...releasedFrom(ended.erased)]);
        setSelection([...selection].filter(id => !ended.erased.has(id)));
        break;
      }
      case 'peel':
        // Dragged off, the note lands and is ready for typing; a click without a drag was a click on the pile.
        if (ended.moved) {
          commit([ended.element]);
          setSelection([ended.element.id]);
          startEditing(scene.element(ended.element.id) ?? ended.element);
        } else {
          setSelection([ended.stack.id]);
        }

        break;
      case 'pan':
      case 'marquee':
      case 'laser':
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
    // Inside a shape is inside it, filled or not: a click there lands on its outline only, a double-click labels it.
    const hit = topmostAt(point) ?? shapeAround(point);
    // Into a group: the member under the pointer, alone. A second double-click on a text in it edits the text.
    if (hit?.group && hit.group !== insideGroup) {
      insideGroup = hit.group;
      setSelection([hit.id]);

      return;
    }

    // A text or a sticky is edited; a shape is labelled — the same double-click, what is written sits in its middle.
    if (hit && (holdsText(hit.type) || takesLabel(hit.type))) {
      startEditing({ ...hit, text: hit.text ?? '' });

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
    stopFollowing();
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

  // ── A sticky carried off its pad ─────────────────────────────────────────────────────────────────────────────────

  /** Where a carried sticky would land: centred under the pointer, so it is put down where it is seen. */
  const carriedAt = (element: BoardElement, [x, y]: Point): BoardElement => ({
    ...element,
    x: x - element.width / 2,
    y: y - element.height / 2,
    z: scene.topZ + 1
  });

  const endCarry = (): void => {
    if (!carrying) {
      return;
    }

    draft.delete(carrying.element.id);
    carrying = undefined;
    window.removeEventListener('pointermove', onCarryMove);
    window.removeEventListener('pointerup', onCarryUp);
    canvas.style.cursor = CURSORS[props.tool];
    reportPointer(true);
    invalidate();
  };

  /** Down on the board: kept, selected, and open for typing — the next thing anyone does with a new sticky. */
  function putDown(point: Point): void {
    const carried = carrying?.element;
    endCarry();
    if (!carried) {
      return;
    }

    const placed = carriedAt(carried, point);
    commit([placed]);
    setSelection([placed.id]);
    // A note is written on the moment it lands; a pile is there to be taken from.
    if (placed.type === 'sticky') {
      startEditing(scene.element(placed.id) ?? placed);
    }
  }

  /** Followed on the whole window: the pad the sticky was taken from is outside the canvas. */
  function onCarryMove(event: PointerEvent): void {
    if (!carrying) {
      return;
    }

    const from = carrying.from ?? [event.clientX, event.clientY];
    carrying.from = from;
    carrying.moved ||= Math.hypot(event.clientX - from[0], event.clientY - from[1]) > CARRY_DRAG;
    const rect = canvas.getBoundingClientRect();
    carrying.over =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (carrying.over) {
      const point = toBoard(camera, event.clientX - rect.left, event.clientY - rect.top);
      lastPointer = point;
      draft.set(carrying.element.id, carriedAt(carrying.element, point));
    } else {
      draft.delete(carrying.element.id);
    }

    reportPointer(false);
    invalidate();
  }

  /**
   * Let go: dragged onto the board, it lands there; dragged anywhere else, it goes back. Let go without moving — a
   * click on the pad — it stays in hand until a click on the board puts it down.
   */
  function onCarryUp(event: PointerEvent): void {
    if (!carrying?.moved) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (carrying.over) {
      putDown(toBoard(camera, event.clientX - rect.left, event.clientY - rect.top));
    } else {
      endCarry();
    }
  }

  // ── Pictures pasted or dropped ───────────────────────────────────────────────────────────────────────────────────

  /**
   * A picture onto the board: shown at once from this page's copy, sized to sit comfortably in view, and handed to the
   * page to upload. It is committed only once the server has kept it (`placeImage`), so nobody else ever sees an
   * image that is not there.
   */
  const addPicture = async (file: File, at?: Point): Promise<void> => {
    const picture = await readPicture(file);
    const fit = Math.min(1, 480 / picture.width, 360 / picture.height);
    const [width, height] = [picture.width * fit, picture.height * fit];
    const view = viewport();
    const [cx, cy] = at ?? lastPointer ?? [view.x + view.width / 2, view.y + view.height / 2];
    const element: BoardElement = { ...newElement('image', [cx - width / 2, cy - height / 2]), width, height };
    pictures.hold(element.id, picture.image);
    draft.set(element.id, element);
    invalidate();
    emit({ type: 'image', id: element.id, data: picture.data });
  };

  const onPaste = (event: ClipboardEvent): void => {
    const file =
      props.mode === 'edit' && !typing(event.target) ? pictureIn(event.clipboardData?.items ?? []) : undefined;
    if (file) {
      event.preventDefault();
      void addPicture(file);
    }
  };

  const onDragOver = (event: DragEvent): void => {
    if (props.mode === 'edit' && event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
    }
  };

  const onDrop = (event: DragEvent): void => {
    const file = props.mode === 'edit' ? pictureIn(event.dataTransfer?.files ?? []) : undefined;
    if (file) {
      event.preventDefault();
      void addPicture(file, toBoard(camera, ...screenOf(event)));
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('dragover', onDragOver);
  canvas.addEventListener('drop', onDrop);
  window.addEventListener('paste', onPaste);
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

  const zoomBy = (factor: number): void => {
    stopFollowing();
    setCamera(zoomAt(camera, size.width / 2, size.height / 2, camera.zoom * factor));
  };

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
        if ('laser' in data && data.laser === true) {
          effects.trail(from, remote.cursor);
        }
      }

      if ('chat' in data && typeof data.chat === 'string') {
        if (data.chat) {
          remote.chat = data.chat.slice(0, 160);
          remote.chatEndedAt = undefined;
        } else if (remote.chat && remote.chatEndedAt === undefined) {
          remote.chatEndedAt = Date.now();
          setTimeout(invalidate, CHAT_LINGER_MS + 50);
        }
      }

      if ('view' in data && Array.isArray(data.view) && data.view.length === 4 && data.view.every(isFiniteNumber)) {
        remote.view = [data.view[0], data.view[1], data.view[2], data.view[3]];
        if (following === from) {
          showView(remote.view);
        }
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

      // Somebody followed who left: there is nothing to follow.
      if (following && !members.has(following)) {
        stopFollowing();
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
      // The arrows fixed to what goes stay, let go where they are drawn.
      const removed = selected();
      commit([
        ...removed.map(element => ({ ...element, deleted: true })),
        ...releasedFrom(new Set(removed.map(element => element.id)))
      ]);
      setSelection([]);
    }),
    selectAll: unlessEditing(() => setSelection(scene.visible().map(element => element.id))),
    duplicate: unlessEditing(() => {
      const top = scene.topZ;
      // A copy of a group is a group of its own: the copies must not be picked up with the originals.
      const groups = new Map<string, string>();
      const chosen = selected().sort(byZ);
      // A connector copied with what it connects connects the copies; copied alone, it lets go.
      const ids = new Map(chosen.map(element => [element.id, newId()]));
      const rebind = (binding: Binding | undefined): Binding | undefined => {
        const id = binding ? ids.get(binding.id) : undefined;

        return binding && id ? { ...binding, id } : undefined;
      };
      const copies = chosen.map((element, index) => {
        const group = element.group === undefined ? undefined : (groups.get(element.group) ?? newId());
        if (element.group !== undefined && group !== undefined) {
          groups.set(element.group, group);
        }

        const { start: _start, end: _end, ...rest } = element;
        const [start, end] = [rebind(element.start), rebind(element.end)];

        return {
          ...rest,
          id: ids.get(element.id) ?? newId(),
          x: element.x + 16,
          y: element.y + 16,
          z: top + 1 + index,
          version: 0,
          ...(group === undefined ? {} : { group }),
          ...(start ? { start } : {}),
          ...(end ? { end } : {})
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
      endCarry();
      finishEditing();
      setSelection([]);
    },

    /** A sticky taken off the pad, in `fill`'s paper: dragged onto the board, or clicked and then placed. */
    carry: ({ fill, kind }: { fill?: unknown; kind?: unknown }): void => {
      endCarry();
      const paper: Fill = isOneOf(FILLS, fill) && fill !== 'none' ? fill : 'yellow';
      // A note, or a whole pile of them for everyone to take from.
      const element =
        kind === 'stack'
          ? { ...newElement('stack', [0, 0]), ...STACK_BOX, fill: paper }
          : { ...newElement('sticky', [0, 0]), ...DEFAULT_BOX.sticky, fill: paper };
      carrying = {
        element,
        moved: false,
        over: false
      };
      setSelection([]);
      canvas.style.cursor = 'grabbing';
      window.addEventListener('pointermove', onCarryMove);
      window.addEventListener('pointerup', onCarryUp);
    },

    /** Show what a member shows, and keep showing it as they move — until this person touches the board. */
    follow: ({ from }: { from?: unknown }): void => {
      if (typeof from !== 'string' || !members.has(from)) {
        return;
      }

      following = from;
      emit({ type: 'follow', name: members.get(from)?.name ?? '' });
      const view = remotes.get(from)?.view;
      if (view) {
        showView(view);
      }
    },
    unfollow: stopFollowing,

    /** A reaction, floating up where this person points — or mid-view — for everyone on the board. */
    react: ({ emoji }: { emoji?: unknown }): void => {
      if (!isReaction(emoji)) {
        return;
      }

      const view = viewport();
      const point: Point = lastPointer ?? [view.x + view.width / 2, view.y + view.height / 2];
      effects.react(emoji, point);
      emit({ type: 'reaction', reaction: { emoji, x: Math.round(point[0]), y: Math.round(point[1]) } });
      invalidate();
    },

    /** The server kept the picture: the element that shows it is committed, naming the asset. */
    placeImage: ({ id, asset }: { id?: unknown; asset?: unknown }): void => {
      const element = typeof id === 'string' ? draft.get(id) : undefined;
      if (!element || typeof asset !== 'string' || !asset) {
        return;
      }

      pictures.place(element.id, asset);
      draft.delete(element.id);
      commit([{ ...element, asset }]);
      setSelection([element.id]);
    },

    /** The server refused the picture: it goes, from this screen as from every other. */
    cancelImage: ({ id }: { id?: unknown }): void => {
      if (typeof id === 'string') {
        pictures.drop(id);
        draft.delete(id);
        invalidate();
      }
    },

    /** A vote for the one element selected, or back from it. */
    vote: unlessEditing(() => {
      const chosen = selected();
      if (chosen.length === 1 && !isLinear(chosen[0].type)) {
        emit({ type: 'vote', id: chosen[0].id });
      }
    }),

    /** Opens the chat field where this person points: what they type shows at their cursor, on every screen. */
    chat: unlessEditing(() => {
      const view = viewport();
      const [x, y] = toScreen(camera, ...(lastPointer ?? [view.x + view.width / 2, view.y + view.height / 2]));
      chatting = '';
      emit({ type: 'chat', at: { left: x, top: y } });
    }),

    typeChat: (text: string): void => {
      if (chatting !== undefined) {
        chatting = text.slice(0, 160);
        reportPointer(false);
      }
    },

    closeChat: (): void => {
      if (chatting === undefined) {
        return;
      }

      // Said once more as empty: the others let the words fade rather than cutting them off.
      chatting = '';
      reportPointer(true);
      chatting = undefined;
      emit({ type: 'chat', at: undefined });
    },

    /** Everyone on the board, brought to what this person is looking at. */
    summon: (): void => {
      const view = viewport();
      emit({
        type: 'summon',
        view: [Math.round(view.x), Math.round(view.y), Math.round(view.width), Math.round(view.height)]
      });
    },

    remoteSummon: (from: string, data: unknown): void => {
      const view =
        typeof data === 'object' && data !== null && 'view' in data && Array.isArray(data.view) ? data.view : [];
      if (view.length !== 4 || !view.every(isFiniteNumber)) {
        return;
      }

      stopFollowing();
      showView([view[0], view[1], view[2], view[3]]);
      emit({ type: 'summoned', name: members.get(from)?.name ?? 'Someone' });
    },

    remoteReaction: (data: unknown): void => {
      if (
        typeof data === 'object' &&
        data !== null &&
        'emoji' in data &&
        isReaction(data.emoji) &&
        'x' in data &&
        'y' in data &&
        isPoint([data.x, data.y])
      ) {
        effects.react(data.emoji, [Number(data.x), Number(data.y)]);
        invalidate();
      }
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
      endCarry();
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
      window.removeEventListener('paste', onPaste);
      canvas.removeEventListener('dragover', onDragOver);
      canvas.removeEventListener('drop', onDrop);
    }
  };
};

export type BoardController = ReturnType<typeof createBoardController>;
