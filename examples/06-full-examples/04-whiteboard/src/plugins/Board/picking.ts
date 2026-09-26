import { endsOf } from './connectors.ts';
import { CARD_CHECK, voteBadgeBox } from './draw.ts';
import { beyondAnchor, boundsOf, handlePoint, HANDLES, hits, snapToAnchor, toScreen, unionOf } from './geometry.ts';
import { ANCHORS, isConnectable, takesLabel } from '../../board/model.ts';

import type { Core } from './core.ts';
import type { Handle } from './geometry.ts';
import type { Binding, BoardElement, Point } from '../../board/model.ts';

/**
 * What is under the pointer — an element, a handle, a vote badge, a connection point, an anchor to snap to. Asked on
 * every move, of what is drawn right now: drafts and remote drags included.
 */

/** How far off a shape's edge its connection points sit, and how close a pointer must come to grab one — in pixels. */
export const CONNECT_OFFSET = 14;

export const GRAB_RADIUS = 9;

/** How far past a shape's box a connector's end still snaps to it — in pixels. */
export const SNAP_REACH = 18;

const inside = (point: Point, box: { x: number; y: number; width: number; height: number }, margin = 0): boolean =>
  point[0] >= box.x - margin &&
  point[0] <= box.x + box.width + margin &&
  point[1] >= box.y - margin &&
  point[1] <= box.y + box.height + margin;

export const createPicking = (core: Core) => {
  const { state } = core;
  const zoom = (): number => state.camera.zoom;
  const selecting = (): boolean => state.props.tool === 'select';

  /** The topmost shape a point is inside — its whole area, not just its outline or its fill. */
  const shapeAround = (point: Point): BoardElement | undefined =>
    core
      .displayed()
      .toReversed()
      .find(
        element =>
          takesLabel(element.type) &&
          hits({ ...element, fill: element.fill === 'none' ? 'red' : element.fill }, point, 0)
      );

  /**
   * What a press takes: whatever is drawn under the point — an outline, a note, a picture — and, failing that, the
   * shape the point is inside. A shape with no fill is picked up anywhere in it, not only on its outline; what lies in
   * it still comes first, so a note inside a hollow box is the note.
   */
  const topmostAt = (point: Point): BoardElement | undefined =>
    core
      .displayed()
      .toReversed()
      .find(element => hits(element, point, 6 / zoom())) ?? shapeAround(point);

  /** The element whose vote badge is under a point — only elements with votes show one. */
  const voteAt = (point: Point): string | undefined =>
    core
      .displayed()
      .toReversed()
      .find(element => (element.votes?.length ?? 0) > 0 && inside(point, voteBadgeBox(element)))?.id;

  /** The card whose done box is under a point — a little larger than drawn, so it is easy to hit. */
  const checkAt = (point: Point): BoardElement | undefined => {
    const hit = core.editable() && selecting() ? topmostAt(point) : undefined;
    const { x, y, size } = CARD_CHECK;

    return hit?.type === 'card' && inside(point, { x: hit.x + x, y: hit.y + y, width: size, height: size }, 4 / zoom())
      ? hit
      : undefined;
  };

  /** The anchor a point snaps to — on the topmost element near it, never on `exclude` or on a line. */
  const snapAt = (point: Point, exclude?: string, toward?: Point): Binding | undefined => {
    const reach = SNAP_REACH / zoom();
    for (const element of core.displayed().toReversed()) {
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

  const handleAt = (screenX: number, screenY: number): Handle | undefined => {
    const box = unionOf(core.selected().map(boundsOf));
    // A lone connector is resized by its ends, not by its box.
    if (!box || !selecting() || core.soleConnector()) {
      return undefined;
    }

    return HANDLES.find(handle => {
      const [bx, by] = handlePoint(box, handle);
      const [x, y] = toScreen(state.camera, bx, by);
      const offsetX = handle === 'nw' || handle === 'sw' ? -6 : 6;
      const offsetY = handle === 'nw' || handle === 'ne' ? -6 : 6;

      return Math.abs(screenX - x - offsetX) <= 8 && Math.abs(screenY - y - offsetY) <= 8;
    });
  };

  /** The end of the sole selected connector under a screen point, if one is. */
  const endpointAt = (screenX: number, screenY: number): 'start' | 'end' | undefined => {
    const connector = selecting() ? core.soleConnector() : undefined;
    if (!connector) {
      return undefined;
    }

    const ends = endsOf(connector);

    return (['start', 'end'] as const).find(which => {
      const [x, y] = toScreen(state.camera, ...ends[which]);

      return Math.hypot(screenX - x, screenY - y) <= GRAB_RADIUS;
    });
  };

  /** The connection point of the hovered shape under a screen point: where a connector drawn from here starts. */
  const connectionAt = (screenX: number, screenY: number): Binding | undefined => {
    const target = selecting() && state.hovered ? core.current().get(state.hovered) : undefined;
    if (!target || !isConnectable(target.type)) {
      return undefined;
    }

    const anchor = ANCHORS.find(candidate => {
      const [x, y] = toScreen(state.camera, ...beyondAnchor(target, candidate, CONNECT_OFFSET / zoom()));

      return Math.hypot(screenX - x, screenY - y) <= GRAB_RADIUS;
    });

    return anchor ? { id: target.id, anchor } : undefined;
  };

  /**
   * The shape whose connection points show: the topmost one within reach of the pointer — past its edge, so the
   * points just outside it can be reached without them vanishing on the way.
   */
  const hoveredAt = (point: Point): string | undefined => {
    const reach = (CONNECT_OFFSET + GRAB_RADIUS) / zoom();

    return core
      .displayed()
      .toReversed()
      .find(
        element =>
          isConnectable(element.type) && element.id !== state.editing && inside(point, boundsOf(element), reach)
      )?.id;
  };

  return { topmostAt, checkAt, voteAt, shapeAround, snapAt, handleAt, endpointAt, connectionAt, hoveredAt };
};

export type Picking = ReturnType<typeof createPicking>;
