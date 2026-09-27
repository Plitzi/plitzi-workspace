import { detachEnd } from './geometry.ts';
import { isConnector } from '../../board/model.ts';

import type { Binding, BoardElement, Point } from '../../board/model.ts';

/** A linear element's two ends, on the board. */
export const endsOf = (element: BoardElement): { start: Point; end: Point } => {
  const points = element.points ?? [[0, 0]];
  const [sx, sy] = points[0];
  const [ex, ey] = points[points.length - 1];

  return { start: [element.x + sx, element.y + sy], end: [element.x + ex, element.y + ey] };
};

/**
 * A connector from `from` to `to`, fixed at whichever ends are bound. Written with its raw points; the canvas bends it
 * into its curve each time it is drawn.
 */
export const connectorBetween = (
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
export const detachOutside = (element: BoardElement, kept: ReadonlySet<string>): BoardElement => {
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
export const releasedFrom = (shown: readonly BoardElement[], removed: ReadonlySet<string>): BoardElement[] => {
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
