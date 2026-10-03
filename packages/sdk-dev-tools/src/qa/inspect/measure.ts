/** A box on the screen, as `getBoundingClientRect` gives it. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A distance to draw: a line from one point to another and its length in px. */
export interface Distance {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
}

const line = (x1: number, y1: number, x2: number, y2: number): Distance => ({
  x1,
  y1,
  x2,
  y2,
  length: Math.round(Math.hypot(x2 - x1, y2 - y1))
});

const middle = (from: number, to: number): number => (from + to) / 2;

/**
 * The distances between two boxes, as a design tool draws them: the gap between them on each axis they are apart on,
 * or, when one holds the other, from each of its sides to the outer box's.
 */
export const distancesBetween = (from: Box, to: Box): Distance[] => {
  const inside = from.left >= to.left && from.right <= to.right && from.top >= to.top && from.bottom <= to.bottom;
  const holds = to.left >= from.left && to.right <= from.right && to.top >= from.top && to.bottom <= from.bottom;
  if (inside || holds) {
    const [inner, outer] = inside ? [from, to] : [to, from];
    const x = middle(inner.left, inner.right);
    const y = middle(inner.top, inner.bottom);

    return [
      line(x, outer.top, x, inner.top),
      line(inner.right, y, outer.right, y),
      line(x, inner.bottom, x, outer.bottom),
      line(outer.left, y, inner.left, y)
    ].filter(distance => distance.length > 0);
  }

  const distances: Distance[] = [];
  // Where they share a stretch of one axis, the line runs along it; otherwise along the first box's middle.
  const y = middle(Math.max(from.top, to.top), Math.min(from.bottom, to.bottom));
  const x = middle(Math.max(from.left, to.left), Math.min(from.right, to.right));
  const rowY = from.bottom > to.top && to.bottom > from.top ? y : middle(from.top, from.bottom);
  const columnX = from.right > to.left && to.right > from.left ? x : middle(from.left, from.right);
  if (to.left >= from.right) {
    distances.push(line(from.right, rowY, to.left, rowY));
  } else if (from.left >= to.right) {
    distances.push(line(to.right, rowY, from.left, rowY));
  }

  if (to.top >= from.bottom) {
    distances.push(line(columnX, from.bottom, columnX, to.top));
  } else if (from.top >= to.bottom) {
    distances.push(line(columnX, to.bottom, columnX, from.top));
  }

  return distances;
};
