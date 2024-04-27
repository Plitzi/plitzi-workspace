import { getIdealBoxSides, isPointOnLeftOrRightSide } from './box';

// Find the center of two points using rudimentary
// linear interpolation.
/**
 * @param {{
 *   x: number;
 *   y: number;
 * }} pointA
 * @param {{
 *   x: number;
 *   y: number;
 * }} pointB
 * @returns {{
 *   x: number;
 *   y: number;
 * }}
 */
export function getLineCenter(pointA, pointB) {
  return {
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2
  };
}

// Given a cubic bezier curve, produce its corresponding SVG path string.
/**
 * @param {{
 *   start: { x: number; y: number };
 *   control1: { x: number; y: number };
 *   control2: { x: number; y: number };
 *   end: { x: number; y: number };
 * }} bezier
 * @returns {string}
 */
export function getCubicBezierSVGPath(bezier) {
  const { start, control1, control2, end } = bezier;

  return [
    `M${start.x},${start.y}`,
    `C${control1.x},${control1.y} ${control2.x},${control2.y}`,
    `${end.x},${end.y}`
  ].join(' ');
}

// Given two points, produce a cubic bezier curve that links them.
/**
 * @param {{
 *   x: number;
 *   y: number;
 * }} start
 * @param {{
 *   x: number;
 *   y: number;
 * }} end
 * @param {{
 *   flip?: boolean;
 * }} options
 * @param {number} curveRate
 * @returns {{
 *   start: { x: number; y: number };
 *   control1: { x: number; y: number };
 *   control2: { x: number; y: number };
 *   end: { x: number; y: number };
 * }}
 */
export function getCurve(start, end, options, curveRate) {
  if (curveRate > 1 || curveRate < 0) {
    curveRate = 0.75;
  }

  const dX = (end.x - start.x) * (options?.flip ? curveRate : 0);
  const dY = (end.y - start.y) * (options?.flip ? 0 : -curveRate);

  let controlPoints = [
    {
      x: start.x + dX,
      y: start.y - dY
    },
    {
      x: end.x - dX,
      y: end.y + dY
    }
  ];
  if (options?.flip) {
    controlPoints = [
      {
        x: start.x + dX,
        y: start.y - dY
      },
      {
        x: end.x - dX,
        y: end.y + dY
      }
    ];
  }

  return { start, control1: controlPoints[0], control2: controlPoints[1], end };
}

// Given two boxes, produce a cubic bezier curve that links them.
/**
 * @param {{
 *   x: number;
 *   y: number;
 *   w: number;
 * }} startBox
 * @param {{
 *   x: number;
 *   y: number;
 *   w: number;
 * }} endBox
 * @returns {{
 *   start: { x: number; y: number };
 *   control1: { x: number; y: number };
 *   control2: { x: number; y: number };
 *   end: { x: number; y: number };
 * }}
 */
export function getBoxToBoxCurve(startBox, endBox) {
  const { startPoint, endPoint } = getIdealBoxSides(startBox, endBox);

  return getCurve(startPoint, endPoint, {
    // Flip the curve if the `startPoint` is on the left/right
    // side of the `startBox` AND the `endPoint` is on the
    // left/right side of the `endBox`.
    //
    // In the future we'll make this an option.
    flip: isPointOnLeftOrRightSide(startPoint, startBox) && isPointOnLeftOrRightSide(endPoint, endBox)
  });
}
