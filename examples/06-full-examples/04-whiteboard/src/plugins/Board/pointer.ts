import { connectorBetween, detachOutside, endsOf, releasedFrom } from './connectors.ts';
import { frameAt } from './containers.ts';
import { DEFAULT_BOX, HANDLE_CURSORS } from './core.ts';
import { CARD_WIDTH, COMMENT_PIN, fontSizeOf, STACK_STRIP } from './draw.ts';
import {
  anchorOf,
  anchorPoint,
  boundsOf,
  boxFrom,
  capPoints,
  contains,
  handlePoint,
  hits,
  movedBy,
  nearestAnchor,
  resolveConnector,
  scaleElement,
  snapAngle,
  toBoard,
  unionOf,
  zoomAt
} from './geometry.ts';
import { isOneOf } from './values.ts';
import { fitsInFrame, holdsText, LIMITS, takesLabel } from '../../board/model.ts';

import type { Carry } from './carry.ts';
import type { Core } from './core.ts';
import type { Effects } from './effects.ts';
import type { Picking } from './picking.ts';
import type { Quick } from './quick.ts';
import type { BoardElement, Point, ShapeType } from '../../board/model.ts';

/** A comment's pin: the same size wherever it is put. */
const PIN_BOX = { width: COMMENT_PIN, height: COMMENT_PIN };

/** The tools that draw a box: dragged to a size, or clicked for their usual one. */
const BOX_TOOLS = [
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
  'hexagon',
  'cylinder',
  'star',
  'sticky',
  'card',
  'frame'
] as const satisfies readonly ShapeType[];

/** The size a box tool makes on a click. */
const usualBox = (type: ShapeType): { width: number; height: number } => {
  if (type === 'sticky' || type === 'card' || type === 'frame') {
    return DEFAULT_BOX[type];
  }

  return DEFAULT_BOX.shape;
};

export const createPointer = (core: Core, picking: Picking, carry: Carry, effects: Effects, quick: Quick) => {
  const { canvas, state, draft, selection, scene } = core;
  const pointers = new Map<number, Point>();

  const screenOf = (event: PointerEvent | MouseEvent | WheelEvent): Point => {
    const rect = canvas.getBoundingClientRect();

    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  const erase = (erased: Set<string>, point: Point): void => {
    for (const element of core.displayed()) {
      if (!erased.has(element.id) && element.locked !== true && hits(element, point, 8 / state.camera.zoom)) {
        erased.add(element.id);
      }
    }
  };

  const startPinch = (): void => {
    const [a, b] = [...pointers.values()];
    state.gesture = undefined;
    draft.clear();
    state.pinch = {
      distance: Math.hypot(a[0] - b[0], a[1] - b[1]),
      center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      camera: state.camera
    };
  };

  /** A press with the select tool: a badge, a pile, a connector's end, a connection point, a handle, or an element. */
  const pressToSelect = (event: PointerEvent, screen: Point, point: Point): void => {
    // A card's box ticks it done — or not — and moves nothing.
    const card = picking.checkAt(point);
    if (card) {
      const { done: _done, ...rest } = card;
      core.sounds.play(card.done ? 'undone' : 'done');
      core.commit([card.done ? rest : { ...rest, done: true }]);

      return;
    }

    // A vote badge is a button on the element: a click on it votes, and moves nothing.
    const badge = picking.voteAt(point);
    if (badge) {
      core.emit({ type: 'vote', id: badge });

      return;
    }

    // A pile gives a note to whoever drags from its paper; its strip moves the pile itself.
    const pile = event.shiftKey ? undefined : picking.topmostAt(point);
    if (pile?.type === 'stack' && point[1] < pile.y + pile.height - STACK_STRIP) {
      const note: BoardElement = { ...core.newElement('sticky', point), ...DEFAULT_BOX.sticky, fill: pile.fill };
      state.gesture = { kind: 'peel', stack: pile, origin: point, moved: false, element: note };

      return;
    }

    const end = picking.endpointAt(...screen);
    const connector = core.soleConnector();
    if (end && connector) {
      state.gesture = { kind: 'endpoint', which: end, element: connector };

      return;
    }

    // From a shape's connection point: an arrow already fixed at this end.
    const from = picking.connectionAt(...screen);
    if (from) {
      const origin = anchorPoint(core.current().get(from.id) ?? core.newElement('arrow', point), from.anchor);
      core.setSelection([]);
      // Let go without a drag, it is a click on the point: a new one of the same, connected that way (`quick.ts`).
      state.gesture = {
        kind: 'linear',
        origin,
        element: { ...core.newElement('arrow', origin), start: from },
        quick: true
      };

      return;
    }

    const handle = picking.handleAt(...screen);
    const chosen = core.changeable();
    const box = unionOf(chosen.map(boundsOf));
    if (handle && box) {
      const ids = new Set(chosen.map(element => element.id));
      state.gesture = {
        kind: 'resize',
        handle,
        anchor: anchorOf(box, handle),
        box,
        originals: chosen.map(element => detachOutside(element, ids))
      };

      return;
    }

    const hit = picking.topmostAt(point);
    if (!hit) {
      const base = new Set(event.shiftKey ? selection : []);
      core.setSelection(base);
      state.gesture = { kind: 'marquee', origin: point, current: point, base };

      return;
    }

    if (event.shiftKey) {
      const next = new Set(selection);
      const picked = hit.group && hit.group !== state.insideGroup ? core.membersOf(hit.group) : [hit.id];
      const removing = next.has(hit.id);
      picked.forEach(id => (removing ? next.delete(id) : next.add(id)));
      core.setSelection(next);

      return;
    }

    if (!selection.has(hit.id)) {
      core.setSelection([hit.id]);
    }

    // A frame carries what is in it. A connector moved without the shapes it is fixed to lets go of them, and stays
    // where it is put.
    const moving = core.changeable();
    const ids = new Set(moving.map(element => element.id));
    const riders = core
      .displayed()
      // What is locked in a frame stays where it is when the frame moves: that is what locking it says.
      .filter(element => element.parent && ids.has(element.parent) && !ids.has(element.id) && element.locked !== true);
    riders.forEach(element => ids.add(element.id));
    state.gesture = {
      kind: 'move',
      origin: point,
      originals: [...moving, ...riders].map(element => detachOutside(element, ids)),
      ids,
      loose: moving.filter(element => fitsInFrame(element.type)).map(element => element.id)
    };
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!core.present()) {
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
    core.stopFollowing();
    if (state.carrying) {
      carry.putDown(toBoard(state.camera, ...screen));

      return;
    }

    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, screen);
    if (pointers.size === 2) {
      startPinch();
      core.invalidate();

      return;
    }

    if (state.editing) {
      core.finishEditing();
    }

    const point = toBoard(state.camera, ...screen);
    state.lastPointer = point;
    const { tool } = state.props;
    // A board that cannot change is looked around: every press pans it, the laser aside.
    const panning = !core.editable() && tool !== 'laser';
    if (event.button === 1 || tool === 'hand' || state.spaceHeld || panning) {
      state.gesture = { kind: 'pan', start: screen, camera: state.camera };
      canvas.style.cursor = 'grabbing';

      return;
    }

    if (event.button !== 0) {
      return;
    }

    switch (tool) {
      case 'select':
        pressToSelect(event, screen, point);
        break;
      case 'laser':
        core.sounds.play('laser');
        state.gesture = { kind: 'laser' };
        effects.trail('me', point);
        break;
      case 'eraser': {
        const erased = new Set<string>();
        erase(erased, point);
        state.gesture = { kind: 'erase', erased };
        break;
      }
      case 'text': {
        // Placed so the click lands inside the first line rather than on its top edge.
        const element = core.newElement('text', point);
        core.setSelection([]);
        core.startEditing({ ...element, y: element.y - fontSizeOf(element) * 0.6 });
        core.switchTool('select');
        break;
      }
      case 'arrow':
      case 'line': {
        // Started on a shape: fixed to it from the first moment, and leaving it by the side that faces wherever the
        // other end is — which follows the pointer until it is let go, so the arrow never cuts back across the shape.
        core.setSelection([]);
        const start = picking.snapAt(point);
        const target = start ? core.current().get(start.id) : undefined;
        const origin = start && target ? anchorPoint(target, start.anchor) : point;
        const element = core.newElement(tool, origin);
        const facing = start && target ? start.id : undefined;
        state.gesture = {
          kind: 'linear',
          origin,
          element: start ? { ...element, start } : element,
          ...(facing ? { facing } : {})
        };
        break;
      }
      case 'freehand':
        core.setSelection([]);
        state.gesture = { kind: 'freehand', element: core.newElement('freehand', point) };
        break;
      case 'comment': {
        // Pinned by its tail: the bottom-left of the pin is the point clicked, what the comment is about.
        const element = { ...core.newElement('comment', [point[0], point[1] - COMMENT_PIN]), ...PIN_BOX };
        core.setSelection([]);
        core.startEditing(element);
        core.switchTool('select');
        break;
      }
      case 'column':
        core.setSelection([]);
        state.gesture = {
          kind: 'box',
          origin: point,
          element: { ...core.newElement('frame', point), layout: 'column' },
          column: true
        };
        break;
      default:
        if (isOneOf(BOX_TOOLS, tool)) {
          core.setSelection([]);
          state.gesture = { kind: 'box', origin: point, element: core.newElement(tool, point) };
        }

        break;
    }

    core.invalidate();
  };

  /** No button held: what is under the pointer shows how it can be taken — and the others see where it is. */
  const hover = (screen: Point, point: Point): void => {
    const selecting = state.props.tool === 'select' && core.editable();
    const shown = selecting ? picking.hoveredAt(point) : undefined;
    if (shown !== state.hovered) {
      state.hovered = shown;
      core.invalidate();
    }

    // A comment pointed at opens its bubble, for anyone looking around — a read-only board's too.
    const pointed = picking.topmostAt(point)?.id;
    if (pointed !== state.pointed) {
      state.pointed = pointed;
      core.invalidate();
    }

    const handle = selecting ? picking.handleAt(...screen) : undefined;
    const grab = selecting && (picking.endpointAt(...screen) ?? picking.connectionAt(...screen));
    const over = selecting && !handle ? picking.topmostAt(point) : undefined;
    canvas.style.cursor = state.spaceHeld
      ? 'grab'
      : handle
        ? HANDLE_CURSORS[handle]
        : grab
          ? 'crosshair'
          : over
            ? 'move'
            : core.restCursor();
    core.reportPointer(false);
  };

  const pinchTo = (): void => {
    const { pinch } = state;
    if (!pinch) {
      return;
    }

    core.stopFollowing();
    const [a, b] = [...pointers.values()];
    const distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const center: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const zoomed = zoomAt(pinch.camera, ...pinch.center, pinch.camera.zoom * (distance / Math.max(pinch.distance, 1)));
    core.setCamera({
      ...zoomed,
      x: zoomed.x - (center[0] - pinch.center[0]) / zoomed.zoom,
      y: zoomed.y - (center[1] - pinch.center[1]) / zoomed.zoom
    });
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!core.present()) {
      return;
    }

    const screen = screenOf(event);
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, screen);
    }

    if (state.pinch && pointers.size === 2) {
      pinchTo();

      return;
    }

    const point = toBoard(state.camera, ...screen);
    state.lastPointer = point;
    const { gesture } = state;
    if (!gesture) {
      hover(screen, point);

      return;
    }

    switch (gesture.kind) {
      case 'pan': {
        const [startX, startY] = gesture.start;
        core.setCamera({
          ...gesture.camera,
          x: gesture.camera.x - (screen[0] - startX) / state.camera.zoom,
          y: gesture.camera.y - (screen[1] - startY) / state.camera.zoom
        });
        break;
      }
      case 'move': {
        const dx = point[0] - gesture.origin[0];
        const dy = point[1] - gesture.origin[1];
        for (const original of gesture.originals) {
          draft.set(original.id, movedBy(original, dx, dy));
        }

        // Where it would land, shown as it is dragged: the frame under the pointer, the gap in a column.
        const first = gesture.loose.length ? scene.element(gesture.loose[0]) : undefined;
        core.aimDrop(gesture.loose.length ? point : undefined, gesture.ids, first?.parent);
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
          draft.set(original.id, scaleElement(original, anchor, scaleX, scaleY, fontSizeOf(original)));
        }

        break;
      }
      case 'marquee': {
        gesture.current = point;
        const area = boxFrom(gesture.origin, point);
        const inside = core
          .displayed()
          .filter(element => element.locked !== true && contains(area, boundsOf(element)))
          .map(element => element.id);
        core.setSelection([...gesture.base, ...inside]);
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
        const shown = core.current();
        const startTarget = gesture.facing ? shown.get(gesture.facing) : undefined;
        state.snapping = event.shiftKey ? undefined : picking.snapAt(point, gesture.element.start?.id, gesture.origin);
        const { snapping } = state;
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
        state.snapping = picking.snapAt(point, other?.id);
        const moved =
          which === 'start'
            ? connectorBetween(element, point, ends.end, state.snapping, element.end)
            : connectorBetween(element, ends.start, point, element.start, state.snapping);
        draft.set(element.id, moved);
        break;
      }
      case 'laser':
        effects.trail('me', point);
        break;
      case 'peel': {
        gesture.moved ||=
          Math.hypot(point[0] - gesture.origin[0], point[1] - gesture.origin[1]) * state.camera.zoom > 4;
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
        const last = points.at(-1);
        const next: Point = [point[0] - gesture.element.x, point[1] - gesture.element.y];
        if (!last || Math.hypot(next[0] - last[0], next[1] - last[1]) > 0.5 / state.camera.zoom) {
          gesture.element = { ...gesture.element, points: [...points, next] };
          draft.set(gesture.element.id, gesture.element);
        }

        break;
      }
      case 'erase':
        erase(gesture.erased, point);
        break;
    }

    core.reportPointer(false);
    core.invalidate();
  };

  const endGesture = (cancelled: boolean): void => {
    const ended = state.gesture;
    const target = state.dropTarget;
    state.gesture = undefined;
    state.snapping = undefined;
    state.dropTarget = undefined;
    const drafted = [...draft.values()];
    if (!state.editing) {
      draft.clear();
    }

    canvas.style.cursor = core.restCursor();
    if (!ended || cancelled) {
      core.reportPointer(true);
      core.invalidate();

      return;
    }

    const { zoom } = state.camera;
    switch (ended.kind) {
      case 'move': {
        const loose = new Set(ended.loose);
        const point = state.lastPointer;
        const moved = drafted
          .filter(element => {
            const original = scene.element(element.id);

            return original && (original.x !== element.x || original.y !== element.y);
          })
          .map((element, index) => {
            if (!loose.has(element.id) || !point) {
              return element;
            }

            // Into the frame it was let go over — out of its own when let go outside every frame. Into a column, at
            // the pointer: that is where the gap was shown, and the column lays out by where things are.
            if (!target) {
              const { parent: _parent, ...free } = element;

              return element.parent && !core.frameContains(element.parent, point) ? free : element;
            }

            // Back to the column it came from: where it was, as it was.
            if (target.home) {
              return scene.element(element.id) ?? element;
            }

            const placed = { ...element, parent: target.frame };

            return target.line === undefined ? placed : { ...placed, y: point[1] - element.height / 2 + index * 0.01 };
          });
        // What went back where it was is no change at all. Into a frame — a column above all — it clicks into place.
        const kept = moved.filter(element => element !== scene.element(element.id));
        if (target && !target.home) {
          core.sounds.play('snap');
        }

        core.commit(kept);
        break;
      }
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
        // A text is committed with the box its new size takes, measured, not the one scaled to approximate it.
        core.commit(moved.map(core.measured));
        break;
      }
      case 'box': {
        const { element } = ended;
        const tiny = element.width * zoom < 4 && element.height * zoom < 4;
        const size = ended.column ? DEFAULT_BOX.column : usualBox(element.type);
        const sized = tiny
          ? { ...element, x: ended.origin[0] - size.width / 2, y: ended.origin[1] - size.height / 2, ...size }
          : element;
        // A card is as tall as its words, whatever was dragged: only its width is chosen.
        const placed =
          element.type === 'card' ? core.measured({ ...sized, width: Math.max(sized.width, CARD_WIDTH / 2) }) : sized;
        core.commit([placed]);
        core.sounds.play('place');
        core.setSelection([placed.id]);
        core.switchTool('select');
        // Written on the moment it is made: a note, a card, a frame's title.
        if (holdsText(placed.type)) {
          core.startEditing(scene.element(placed.id) ?? placed);
        }

        break;
      }
      case 'linear': {
        // Kept as it is drawn — its curve baked into its points — and fixed at whichever ends found an anchor.
        const drawn = drafted.find(element => element.id === ended.element.id) ?? ended.element;
        const shown = core.current();
        const { start, end } = endsOf(shown.get(drawn.id) ?? drawn);
        const clicked = Math.hypot(end[0] - start[0], end[1] - start[1]) * zoom < 4;
        if (clicked && ended.quick && drawn.start) {
          quick.grow(drawn.start);
        } else if (!clicked) {
          if (drawn.start || drawn.end) {
            core.sounds.play('connect');
          }

          core.commit([resolveConnector(drawn, id => shown.get(id))]);
          core.setSelection([drawn.id]);
          core.switchTool('select');
        }

        break;
      }
      case 'endpoint': {
        const moved = drafted.find(element => element.id === ended.element.id);
        if (moved) {
          if (moved.start || moved.end) {
            core.sounds.play('connect');
          }

          const shown = core.current();
          core.commit([resolveConnector(moved, id => shown.get(id))]);
        }

        break;
      }
      case 'freehand': {
        // Exactly the points that were drawn: the stroke on release is the one on screen a moment before.
        const points = capPoints(ended.element.points ?? [], LIMITS.points);
        const stroke = points.length > 1 ? points : [[0, 0] as Point, [0.5, 0.5] as Point];
        core.sounds.play('draw');
        const xs = stroke.map(([px]) => px);
        const ys = stroke.map(([, py]) => py);
        core.commit([
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
        if (erased.length) {
          core.sounds.play('remove');
        }

        core.commit([...erased, ...releasedFrom(core.displayed(), ended.erased)]);
        core.setSelection([...selection].filter(id => !ended.erased.has(id)));
        break;
      }
      case 'peel':
        // Dragged off, the note lands and is ready for typing; a click without a drag was a click on the pile.
        if (ended.moved) {
          core.sounds.play('place');
          core.commit([ended.element]);
          core.setSelection([ended.element.id]);
          core.startEditing(scene.element(ended.element.id) ?? ended.element);
        } else {
          core.setSelection([ended.stack.id]);
        }

        break;
      case 'marquee': {
        // A click — no drag — on the empty inside of a frame picks the frame: its title bar is not the only handle.
        const still = Math.hypot(ended.current[0] - ended.origin[0], ended.current[1] - ended.origin[1]) * zoom < 4;
        const frame = still && !ended.base.size ? frameAt(core.displayed(), ended.origin) : undefined;
        if (frame) {
          core.setSelection([frame.id]);
        }

        break;
      }
      case 'pan':
      case 'laser':
        break;
    }

    core.reportPointer(true);
    core.invalidate();
  };

  const onPointerUp = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    if (state.pinch) {
      if (pointers.size < 2) {
        state.pinch = undefined;
      }

      return;
    }

    endGesture(event.type === 'pointercancel');
  };

  const onDoubleClick = (event: MouseEvent): void => {
    if (!core.editable() || state.props.tool !== 'select') {
      return;
    }

    const point = toBoard(state.camera, ...screenOf(event));
    // Inside a shape is inside it, filled or not: a click there lands on its outline only, a double-click labels it.
    const hit = picking.topmostAt(point) ?? picking.shapeAround(point);
    // Into a group: the member under the pointer, alone. A second double-click on a text in it edits the text.
    if (hit?.group && hit.group !== state.insideGroup) {
      state.insideGroup = hit.group;
      core.setSelection([hit.id]);

      return;
    }

    // A text or a sticky is edited; a shape is labelled — the same double-click, what is written sits in its middle.
    if (hit && (holdsText(hit.type) || takesLabel(hit.type))) {
      core.startEditing({ ...hit, text: hit.text ?? '' });

      return;
    }

    if (!hit) {
      core.setSelection([]);
      core.startEditing(core.newElement('text', [point[0], point[1] - 16]));
    }
  };

  const onWheel = (event: WheelEvent): void => {
    if (!core.present()) {
      return;
    }

    event.preventDefault();
    core.stopFollowing();
    const { camera } = state;
    const scale = event.deltaMode === 1 ? 16 : 1;
    const [screenX, screenY] = screenOf(event);
    if (event.ctrlKey || event.metaKey) {
      core.setCamera(zoomAt(camera, screenX, screenY, camera.zoom * Math.exp((-event.deltaY * scale) / 300)));

      return;
    }

    const dx = (event.shiftKey ? event.deltaY : event.deltaX) * scale;
    const dy = (event.shiftKey ? 0 : event.deltaY) * scale;
    core.setCamera({ ...camera, x: camera.x + dx / camera.zoom, y: camera.y + dy / camera.zoom });
  };

  const onPointerLeave = (): void => {
    if (!state.gesture) {
      state.lastPointer = undefined;
    }
  };

  return { screenOf, onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onDoubleClick, onWheel };
};

export type PointerHandlers = ReturnType<typeof createPointer>;
