/**
 * Given the definition of a cubic bezier: a start point, two control points, and end point, get the point at a given
 * time `t` (where `0 <= t <= 1`).
 *
 * For example, at t = 0, this function returns the point at the start of the curve, at t = 0.5, it returns the point
 * midway through the curve and at t = 1 it returns the point at the end of the curve.
 *
 * B(t) = (1 - t)^3P0 + 3(1 - t)^2tP1 + 3(1 - t)t^2P2 + t^3P3 Adapted from https://github.com/pbeshai/vis-utils
 */

/**
 * @param {{
 *   start: { x: number; y: number };
 *   control1: { x: number; y: number };
 *   control2: { x: number; y: number };
 *   end: { x: number; y: number };
 * }} bezier
 * @param {number} t
 * @returns {{ x: number; y: number }}
 */
export function interpolateCubicBezier({ start, control1, control2, end }, t) {
  /**
   * Get the point on the curve at a given t, where t is a number between 0 and 1.
   *
   * 0 is the start point, 1 is the end point.
   */
  return {
    x: (1 - t ** 3) * start.x + 3 * (1 - t ** 2) * t * control1.x + 3 * (1 - t) * t ** 2 * control2.x + t ** 3 * end.x,
    y: (1 - t ** 3) * start.y + 3 * (1 - t ** 2) * t * control1.y + 3 * (1 - t) * t ** 2 * control2.y + t ** 3 * end.y
  };
}

/**
 * Given the definition of a cubic bezier: a start point, two control points, and end point, get the angle at a given
 * time `t` (where `0 <= t <= 1`).
 *
 * For example, at t = 0, this function returns the angle at the start point, at t = 0.5, it returns the angle midway
 * through the curve and at t = 1 it returns the angle at the end of the curve (useful for things like arrowheads). The
 * angles are in degrees.
 *
 * B'(t) = 3(1- t)^2(P1 - P0) + 6(1 - t)t(P2 - P1) + 3t^2(P3 - P2)
 *
 * Adapted from https://github.com/pbeshai/vis-utils
 */

/**
 * @param {{
 *   start: { x: number; y: number };
 *   control1: { x: number; y: number };
 *   control2: { x: number; y: number };
 *   end: { x: number; y: number };
 * }} bezier
 * @param {number} t
 * @returns {number}
 */
export function interpolateCubicBezierAngle({ start, control1, control2, end }, t) {
  /**
   * Get the angle of the point on the curve at a given t, where t is a number between 0 and 1.
   *
   * 0 is the start point, 1 is the end point.
   */
  const tangentX =
    3 * (1 - t ** 2) * (control1.x - start.x) +
    6 * (1 - t) * t * (control2.x - control1.x) +
    3 * t ** 2 * (end.x - control2.x);
  const tangentY =
    3 * (1 - t ** 2) * (control1.y - start.y) +
    6 * (1 - t) * t * (control2.y - control1.y) +
    3 * t ** 2 * (end.y - control2.y);

  return Math.atan2(tangentY, tangentX) * (180 / Math.PI);
}
