import { endsOf } from './connectors.ts';
import {
  createRenderer,
  drawCursor,
  drawDots,
  drawDropTarget,
  drawHandles,
  drawLock,
  drawMarquee,
  drawOutlines,
  drawPoints
} from './draw.ts';
import { anchorPoint, beyondAnchor, boundsOf, boxFrom, contains, toBoard, toScreen, unionOf } from './geometry.ts';
import { CONNECT_OFFSET } from './picking.ts';
import { ANCHORS, isConnectable } from '../../board/model.ts';

import type { Core } from './core.ts';
import type { Renderer } from './draw.ts';
import type { Effects } from './effects.ts';
import type { Box, Camera } from './geometry.ts';
import type { Palette } from './palette.ts';
import type { Pictures } from './pictures.ts';
import type { Gesture } from './types.ts';
import type { BoardElement } from '../../board/model.ts';

/**
 * What `next` adds over `before`, when all it does is add on top: `before` whole and unchanged — the same objects, in
 * the same order — and every new element after it, standing in no frame (a frame counts what it holds, on its label).
 * Undefined when anything else changed, and the board has to be painted again. A note put down, a shape drawn, a
 * stamp, somebody else's arrow: each is one element drawn, not the board again.
 */
const addedOnTop = (
  before: readonly BoardElement[],
  next: readonly BoardElement[]
): readonly BoardElement[] | undefined => {
  if (next.length < before.length) {
    return undefined;
  }

  for (let index = 0; index < before.length; index += 1) {
    if (before[index] !== next[index]) {
      return undefined;
    }
  }

  const added = next.slice(before.length);

  return added.every(element => element.parent === undefined) ? added : undefined;
};

/** More elements changed than this at once and the board is painted whole: finding where would cost more than it saves. */
const MOST_CHANGED = 400;

/**
 * Where the board changed between two paintings of it, in board units: where everything that changed was, and where it
 * is now — and the frames that hold any of it, whose labels count what they hold: `area` is undefined when nothing
 * that shows changed. Undefined when too much changed to be worth finding.
 */
const changedArea = (
  before: readonly BoardElement[],
  next: readonly BoardElement[],
  redrawn: ReadonlySet<string>
): { area: Box | undefined } | undefined => {
  if (Math.abs(before.length - next.length) > MOST_CHANGED) {
    return undefined;
  }

  const gone = new Map(before.map(element => [element.id, element]));
  const boxes: Box[] = [];
  const frames = new Set<string>();
  const touched = (element: BoardElement): void => {
    boxes.push(boundsOf(element));
    if (element.parent) {
      frames.add(element.parent);
    }
  };
  for (const element of next) {
    const was = gone.get(element.id);
    gone.delete(element.id);
    if (was === element && !redrawn.has(element.id)) {
      continue;
    }

    touched(element);
    if (was) {
      touched(was);
    }

    if (boxes.length > MOST_CHANGED * 2) {
      return undefined;
    }
  }

  gone.forEach(touched);
  const byId = frames.size ? new Map(next.map(element => [element.id, element])) : undefined;
  for (const id of frames) {
    const frame = byId?.get(id);
    if (frame) {
      boxes.push(boundsOf(frame));
    }
  }

  return boxes.length > MOST_CHANGED * 2 ? undefined : { area: unionOf(boxes) };
};

/**
 * A selection this small opens what it holds — a note's author, a comment's bubble. A bigger one is a batch being
 * moved or deleted: every note naming its author at once is noise, and a marquee growing over a busy board would repaint
 * the whole board at every step for it.
 */
const OPEN_SELECTION = 20;

/** How far past its box an element may draw — a label, a badge, a wobbly stroke — in board units. */
const DRAWN_MARGIN = 40;

/**
 * How long the view has to stay put before its picture, kept to the nearest pixel while it was dragged, is painted
 * exactly: a drag's pointer moves come a frame or two apart, and a frame between two of them is not the drag ending.
 */
const SETTLE_MS = 150;

const overlaps = (a: Box, b: Box, margin: number): boolean =>
  a.x - margin < b.x + b.width &&
  a.x + a.width + margin > b.x &&
  a.y - margin < b.y + b.height &&
  a.y + a.height + margin > b.y;

/**
 * One frame: the paper, every element in view, and over them what only this screen shows — selections (this person's
 * and the others'), handles, connection points, laser trails, reactions, the marquee and the others' cursors.
 */
export const createPainter = (core: Core, layer: HTMLCanvasElement, effects: Effects, pictures: Pictures) => {
  const { context, state, remotes } = core;
  /**
   * The board itself — the paper and every element — painted onto a canvas of its own, under the one that takes the
   * pointer, and painted again only when something it shows changed: the elements, the view, the theme, what is
   * pointed at or selected, a picture arriving. Everything else a frame draws — cursors, the laser, reactions,
   * selections, handles, the marquee — goes on the canvas over it. With people on a board, a frame is mostly somebody's
   * cursor moving: it used to repaint four thousand elements to move one arrow a few pixels.
   */
  const layerContext = layer.getContext('2d');
  if (!layerContext) {
    throw new Error('The board needs a 2D canvas to draw on');
  }

  const renderer = createRenderer(layer);
  // What moves is drawn on the canvas over the board, by a renderer of its own: rough.js draws on its own canvas.
  const moving = createRenderer(core.canvas);
  /**
   * What this person drags, drawn once. A move shifts everything picked up by the same amount at every step, so the
   * picture of it does not change, only where it is: it is drawn on a canvas of its own when the drag begins and copied
   * into place at every step after — a thousand notes dragged cost one image a frame, not a thousand notes. What does
   * change shape stays drawn as it is each step: an arrow from something dragged to something left where it was, and
   * whatever was not wholly on screen when the drag began.
   */
  const piece = document.createElement('canvas');
  const pieceContext = piece.getContext('2d');
  if (!pieceContext) {
    throw new Error('The board needs a 2D canvas to draw on');
  }

  const pieceRenderer = createRenderer(piece);
  let carried: { gesture: Gesture; key: string; dx: number; dy: number; ids: ReadonlySet<string> } | undefined;
  /**
   * What the board's canvas shows: the elements, the palette, all else it depends on, where the view stood for the
   * picture (`x`, `y`) and where it really stood that frame (`cameraX`, `cameraY`) — apart only while the view is
   * dragged, by less than a pixel.
   */
  let painted:
    | {
        elements: readonly BoardElement[];
        palette: Palette;
        key: string;
        x: number;
        y: number;
        cameraX: number;
        cameraY: number;
        editing: string | undefined;
      }
    | undefined;
  let scrolledAt = 0;
  let reportedBox = '';
  let reportedThread = '';

  /** The one comment selected, with where its thread opens on screen — told to the page only when it changes. */
  const reportThread = (comment: BoardElement | undefined): void => {
    const [left, top] = comment ? toScreen(state.camera, comment.x + comment.width, comment.y) : [0, 0];
    const thread = comment
      ? {
          id: comment.id,
          author: comment.author ?? 'Someone',
          text: comment.text ?? '',
          done: comment.done === true,
          replies: comment.replies ?? [],
          left: Math.round(left + 10),
          top: Math.round(top)
        }
      : undefined;
    const key = JSON.stringify(thread ?? null);
    if (key !== reportedThread) {
      reportedThread = key;
      core.emit({ type: 'thread', thread });
    }
  };

  const colourOf = (from: string): string =>
    state.palette.collab[state.members.get(from)?.color ?? ''] ?? state.palette.accent;

  /** Where the selection is on screen, told to the page only when it changes. */
  const reportBox = (box: Box | undefined): void => {
    const [left, top] = box ? toScreen(state.camera, box.x, box.y) : [0, 0];
    const screen = box
      ? {
          left: Math.round(left),
          top: Math.round(top),
          width: Math.round(box.width * state.camera.zoom),
          height: Math.round(box.height * state.camera.zoom)
        }
      : undefined;
    const key = JSON.stringify(screen ?? null);
    if (key !== reportedBox) {
      reportedBox = key;
      core.emit({ type: 'selectionBox', box: screen });
    }
  };

  const paint = (): void => {
    const { width, height, dpr } = state.size;
    if (!width || !height) {
      return;
    }

    const { camera, palette, props, gesture, editing } = state;
    const now = Date.now();
    // Every change to the board comes through a frame: whether it can be undone is told from here.
    core.reportHistory();
    const elements = core.displayedStill(now);
    const erased = gesture?.kind === 'erase' ? gesture.erased : undefined;
    const key = [
      camera.zoom,
      width,
      height,
      dpr,
      core.present(),
      erased?.size ?? -1,
      pictures.revision,
      props.voter,
      props.authors,
      props.assetBase
    ].join('|');
    let at = { x: camera.x, y: camera.y };
    const moved = painted !== undefined && (painted.x !== camera.x || painted.y !== camera.y);
    const panning = painted !== undefined && (painted.cameraX !== camera.x || painted.cameraY !== camera.y);
    if (painted?.palette !== palette || painted.key !== key) {
      paintBoard(elements, erased);
    } else if (painted.elements !== elements || painted.editing !== editing) {
      // What is being written is drawn without its words, under the editor: starting or stopping changes that one.
      const redrawn = new Set([painted.editing, editing].filter(id => id !== undefined));
      const added = moved || redrawn.size ? undefined : addedOnTop(painted.elements, elements);
      if (moved) {
        paintBoard(elements, erased);
      } else if (added === undefined) {
        repaintChanged(painted.elements, elements, erased, redrawn);
      } else if (added.length) {
        // Only what was put on top: everything under it is already on the board's canvas, exactly as it is.
        onBoard(layerContext);
        drawElements(renderer, layerContext, added, erased, false);
      }
    } else if (moved && panning) {
      at = scrollBoard(painted, elements, erased);
      scrolledAt = now;
      // A picture a fraction of a pixel off the view: once the view stops, it is painted where it is exactly.
      if (at.x !== camera.x || at.y !== camera.y) {
        core.invalidate();
      }
    } else if (moved && now - scrolledAt < SETTLE_MS) {
      at = { x: painted.x, y: painted.y };
      core.invalidate();
    } else if (moved) {
      paintBoard(elements, erased);
    }

    painted = { elements, palette, key, ...at, cameraX: camera.x, cameraY: camera.y, editing };

    // The canvas over the board holds only what moves: cleared, and drawn again, every frame.
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, core.canvas.width, core.canvas.height);
    const inHand = drawCarried(core.displayedMoving(now), `${key}|${camera.x}|${camera.y}`, erased);
    const opened = openedNow();
    if (inHand.length || opened.length) {
      onBoard(context);
      drawElements(moving, context, inHand, erased, true);
      for (const element of opened) {
        moving.drawOpened(context, element, palette, { hideText: element.id === editing, authors: props.authors });
      }
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!core.present()) {
      return;
    }

    paintOver(now);
  };

  /**
   * What is carried in one piece, copied into place on the canvas over the board: drawn first — at the drag's first
   * step, or again when the view or what it looks like changed — then only moved. Answers the rest of `inHand`, to be
   * drawn as it is.
   */
  const drawCarried = (
    inHand: readonly BoardElement[],
    key: string,
    erased: ReadonlySet<string> | undefined
  ): readonly BoardElement[] => {
    const { gesture } = state;
    const lead = gesture?.kind === 'move' ? gesture.originals[0] : undefined;
    const now = lead ? core.draft.get(lead.id) : undefined;
    if (gesture?.kind !== 'move' || !lead || !now) {
      if (carried) {
        carried = undefined;
        // Let go: the piece's pixels are not kept for the next drag.
        piece.width = 0;
        piece.height = 0;
      }

      return inHand;
    }

    const [dx, dy] = [now.x - lead.x, now.y - lead.y];
    if (carried?.gesture !== gesture || carried.key !== key) {
      carried = { gesture, key, dx, dy, ids: paintPiece(gesture, inHand, erased) };
    }

    const { dpr } = state.size;
    const scale = state.camera.zoom * dpr;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(piece, Math.round((dx - carried.dx) * scale), Math.round((dy - carried.dy) * scale));
    const { ids } = carried;

    return inHand.filter(element => !ids.has(element.id));
  };

  /**
   * The piece drawn as it stands now, onto its own canvas: what the drag shifts whole — what was picked up, and the
   * arrows between two things picked up — and wholly on screen. Answers what it holds.
   */
  const paintPiece = (
    gesture: Extract<Gesture, { kind: 'move' }>,
    inHand: readonly BoardElement[],
    erased: ReadonlySet<string> | undefined
  ): ReadonlySet<string> => {
    const picked = new Set(gesture.originals.map(element => element.id));
    const view = core.viewport();
    const margin = DRAWN_MARGIN / state.camera.zoom;
    const whole = inHand.filter(element => {
      // Fixed only to things picked up, and picked up itself or fixed at both ends: it moves as they do, unchanged.
      const ends = [element.start?.id, element.end?.id].filter(id => id !== undefined);
      const rigid = ends.every(id => picked.has(id)) && (picked.has(element.id) || ends.length === 2);
      const box = boundsOf(element);

      return (
        rigid &&
        contains(view, {
          x: box.x - margin,
          y: box.y - margin,
          width: box.width + margin * 2,
          height: box.height + margin * 2
        })
      );
    });
    piece.width = core.canvas.width;
    piece.height = core.canvas.height;
    onBoard(pieceContext);
    drawElements(pieceRenderer, pieceContext, whole, erased, true, view);
    const { dpr } = state.size;
    pieceContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    const outlined = whole.filter(element => core.selection.has(element.id)).map(boundsOf);
    drawOutlines(pieceContext, state.camera, outlined, view, state.palette.accent, true);

    return new Set(whole.map(element => element.id));
  };

  /** How many elements each frame holds, over the whole board — what a frame's label counts. */
  const membersIn = (elements: readonly BoardElement[]): Map<string, number> => {
    const members = new Map<string, number>();
    for (const element of elements) {
      if (element.parent) {
        members.set(element.parent, (members.get(element.parent) ?? 0) + 1);
      }
    }

    return members;
  };

  /** Elements in view, with `with` — the board's renderer on its canvas, the moving ones' on the one over it. */
  const drawElements = (
    use: Renderer,
    context: CanvasRenderingContext2D,
    elements: readonly BoardElement[],
    erased: ReadonlySet<string> | undefined,
    whole: boolean,
    view: Box = core.viewport()
  ): void => {
    const { palette, props, editing } = state;
    const members = membersIn(core.displayed());
    for (const element of elements) {
      if (overlaps(boundsOf(element), view, 40)) {
        use.drawElement(context, element, palette, {
          hideText: element.id === editing,
          faded: erased?.has(element.id) ?? false,
          voter: props.voter,
          members: members.get(element.id) ?? 0,
          authors: props.authors,
          ...(element.type === 'image' ? { picture: pictures.of(element, props.assetBase) } : {})
        });
      }
    }

    // What the renderer keeps is let go only after a whole board: a few added on top say nothing about the rest.
    if (whole) {
      use.prune(new Set(elements.map(element => element.id)));
    }
  };

  /** Board coordinates on `context`, at the camera's zoom and place. */
  const onBoard = (context: CanvasRenderingContext2D, camera: Camera = state.camera): void => {
    const { dpr } = state.size;
    context.setTransform(
      dpr * camera.zoom,
      0,
      0,
      dpr * camera.zoom,
      -camera.x * camera.zoom * dpr,
      -camera.y * camera.zoom * dpr
    );
  };

  /**
   * What is open right now — pointed at, being written, or in a small selection — as it is drawn. A comment selected or
   * being written has its thread or its composer beside it instead of its bubble.
   */
  const openedNow = (): BoardElement[] => {
    const { editing } = state;
    const shown = core.current();
    const candidates = new Set([
      ...(state.pointed ? [state.pointed] : []),
      ...(editing ? [editing] : []),
      ...(core.selection.size <= OPEN_SELECTION ? core.selection : [])
    ]);

    return [...candidates].flatMap(id => {
      const element = shown.get(id);
      if (!element) {
        return [];
      }

      const open =
        element.type === 'comment'
          ? id === state.pointed && id !== editing && !core.selection.has(id)
          : element.type === 'sticky';

      return open ? [element] : [];
    });
  };

  /** The paper and every element that is not moving, onto the board's canvas. */
  const paintBoard = (elements: readonly BoardElement[], erased: ReadonlySet<string> | undefined): void => {
    const { width, height } = state.size;
    paintArea({ x: 0, y: 0, width, height }, elements, erased, true);
  };

  /** The board within `area` of the screen: its paper, its dots, and the elements that reach into it. */
  const paintArea = (
    area: Box,
    elements: readonly BoardElement[],
    erased: ReadonlySet<string> | undefined,
    whole: boolean,
    camera: Camera = state.camera
  ): void => {
    const { dpr } = state.size;
    const { palette } = state;
    const context = layerContext;
    context.save();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!whole) {
      context.beginPath();
      context.rect(area.x, area.y, area.width, area.height);
      context.clip();
    }

    context.fillStyle = palette.paper;
    context.fillRect(area.x, area.y, area.width, area.height);
    if (core.present()) {
      drawDots(context, camera, area, palette.dots);
    }

    onBoard(context, camera);
    const [x, y] = toBoard(camera, area.x, area.y);
    drawElements(renderer, context, elements, erased, whole, {
      x,
      y,
      width: area.width / camera.zoom,
      height: area.height / camera.zoom
    });
    context.restore();
  };

  /**
   * Some elements changed — one written in, one confirmed by the server, somebody else's note moved — and only where
   * they were and are is painted again, with whatever else reaches into it: a change the size of a note costs the
   * elements around a note. Changes out of view paint nothing; a change over most of the view paints it whole.
   */
  const repaintChanged = (
    before: readonly BoardElement[],
    elements: readonly BoardElement[],
    erased: ReadonlySet<string> | undefined,
    redrawn: ReadonlySet<string>
  ): void => {
    const found = changedArea(before, elements, redrawn);
    if (!found) {
      paintBoard(elements, erased);

      return;
    }

    const changed = found.area;
    if (!changed) {
      return;
    }

    const { width, height, dpr } = state.size;
    const { camera } = state;
    const [left, top] = toScreen(camera, changed.x, changed.y);
    const pad = DRAWN_MARGIN * camera.zoom + 8;
    // To whole device pixels, so the edge of what is painted again meets what was left exactly.
    const edge = (value: number, round: (value: number) => number): number => round(value * dpr) / dpr;
    const x0 = Math.max(0, edge(left - pad, Math.floor));
    const y0 = Math.max(0, edge(top - pad, Math.floor));
    const x1 = Math.min(width, edge(left + changed.width * camera.zoom + pad, Math.ceil));
    const y1 = Math.min(height, edge(top + changed.height * camera.zoom + pad, Math.ceil));
    if (x1 <= x0 || y1 <= y0) {
      return;
    }

    if ((x1 - x0) * (y1 - y0) > width * height * 0.6) {
      paintBoard(elements, erased);

      return;
    }

    paintArea({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, elements, erased, false);
  };

  /**
   * The view moved and nothing else did: what the board's canvas holds is moved with it, and only the edges it uncovers
   * are painted — a few elements a frame instead of every one in view. Answers where the view stands for the picture.
   *
   * Moved by whole device pixels: a shift by a fraction would resample the picture, and every step would blur it more.
   * So the picture stands where the view is to the nearest pixel, and the edges are painted from there too — one
   * picture, at one place — until the view stops and it is painted exactly where it is.
   */
  const scrollBoard = (
    from: { x: number; y: number },
    elements: readonly BoardElement[],
    erased: ReadonlySet<string> | undefined
  ): { x: number; y: number } => {
    const { width, height, dpr } = state.size;
    const { camera } = state;
    const scale = camera.zoom * dpr;
    const [shiftX, shiftY] = [Math.round((from.x - camera.x) * scale), Math.round((from.y - camera.y) * scale)];
    if (shiftX === 0 && shiftY === 0) {
      return from;
    }

    if (Math.abs(shiftX) >= layer.width || Math.abs(shiftY) >= layer.height) {
      paintBoard(elements, erased);

      return { x: camera.x, y: camera.y };
    }

    layerContext.save();
    layerContext.setTransform(1, 0, 0, 1, 0, 0);
    layerContext.globalCompositeOperation = 'copy';
    layerContext.drawImage(layer, shiftX, shiftY);
    layerContext.restore();
    const at = { x: from.x - shiftX / scale, y: from.y - shiftY / scale };
    const view = { ...camera, ...at };
    const [left, top] = [shiftX / dpr, shiftY / dpr];
    if (left !== 0) {
      paintArea({ x: left > 0 ? 0 : width + left, y: 0, width: Math.abs(left), height }, elements, erased, false, view);
    }

    if (top !== 0) {
      paintArea({ x: 0, y: top > 0 ? 0 : height + top, width, height: Math.abs(top) }, elements, erased, false, view);
    }

    return at;
  };

  /** What only this screen shows, over the board: selections, handles, drop targets, lasers, cursors. */
  const paintOver = (now: number): void => {
    const { camera, palette, props, gesture, editing } = state;
    const byId = core.current();
    // Where what is dragged would land: the frame lit, and in a column the gap it would take.
    const drop = state.dropTarget ? byId.get(state.dropTarget.frame) : undefined;
    if (drop && state.dropTarget) {
      drawDropTarget(context, camera, boundsOf(drop), palette.accent, state.dropTarget.line);
    }

    const view = core.viewport();
    for (const [from, remote] of remotes.entries()) {
      const boxes = [...remote.selection].flatMap(id => {
        const element = byId.get(id);

        return element ? [boundsOf(element)] : [];
      });
      drawOutlines(context, camera, boxes, view, colourOf(from), false);
    }

    // A frame's title bar pointed at: the frame outlined, so it reads as something to take hold of.
    const pointedFrame = state.pointed ? byId.get(state.pointed) : undefined;
    // Only where it can be taken: a board that is looked around is not offered anything to pick up.
    if (pointedFrame?.type === 'frame' && core.editable() && !core.selection.has(pointedFrame.id)) {
      drawOutlines(context, camera, [boundsOf(pointedFrame)], view, palette.accent, false);
    }

    const chosen = core.selected();
    // What is dragged in one piece has its outline in the piece.
    const outlined = carried ? chosen.filter(element => !carried?.ids.has(element.id)) : chosen;
    drawOutlines(context, camera, outlined.map(boundsOf), view, palette.accent, true);

    const selecting = props.tool === 'select' && !editing;
    for (const element of chosen) {
      if (element.locked) {
        drawLock(context, camera, boundsOf(element), palette.accent);
      }
    }

    const connector = core.soleConnector();
    if (connector && selecting) {
      const { start, end } = endsOf(connector);
      drawPoints(context, camera, [start, end], palette.accent);
    } else if (selecting && (!gesture || gesture.kind === 'resize')) {
      // Handles only on what they could resize: a locked element is held where it is, and says so.
      const resizable = unionOf(core.changeable().map(boundsOf));
      if (resizable) {
        drawHandles(context, camera, resizable, palette.accent);
      }
    }

    // Where a connector can start from, on the shape under the pointer — and where one being drawn will land.
    const { snapping, hovered } = state;
    const target = snapping
      ? byId.get(snapping.id)
      : !gesture && !state.carrying && selecting && hovered
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
      core.invalidate();
    }

    if (gesture?.kind === 'marquee') {
      drawMarquee(context, camera, boxFrom(gesture.origin, gesture.current), palette.accent);
    }

    for (const [from, remote] of remotes.entries()) {
      const member = state.members.get(from);
      const cursor = member ? remotes.cursorOf(remote, now) : undefined;
      if (member && cursor) {
        const label = member.agent === true ? `✦ ${member.name}` : member.name;
        drawCursor(context, camera, cursor.at, label, colourOf(from), palette.ui, cursor.saying);
        // Still on its way to where it was heard: the next frame moves it on.
        if (cursor.moving) {
          core.invalidate();
        }
      }
    }

    // The selection's tools stand aside while it is being moved, resized or typed into — they would cover the work.
    reportBox(selecting && !gesture && !state.pinch ? unionOf(chosen.map(boundsOf)) : undefined);
    const [sole] = chosen;
    reportThread(
      chosen.length === 1 && sole.type === 'comment' && !editing && !gesture && core.editable() ? sole : undefined
    );
  };

  return { paint };
};
