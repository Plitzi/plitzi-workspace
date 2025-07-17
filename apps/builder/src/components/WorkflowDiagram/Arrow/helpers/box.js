// Get a list of points set up at the center of every side of the box (left, right, top, bottom)
/**
 * @param {{
 *   x: number;
 *   y: number;
 *   w: number;
 * }} box
 * @returns {{
 *   x: number;
 *   y: number;
 * }[]}
 */
export function getBoxBounds(box) {
  return [
    { x: box.x, y: box.y + box.h / 2 }, // left
    { x: box.x + box.w, y: box.y + box.h / 2 }, // right
    { x: box.x + box.w / 2, y: box.y }, // top
    { x: box.x + box.w / 2, y: box.y + box.h } // bottom
  ];
}

export function euclideanDistance(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

export function xDistance(pointA, pointB) {
  return Math.abs(pointA.x - pointB.x);
}

export function yDistance(pointA, pointB) {
  return Math.abs(pointA.y - pointB.y);
}

// Find the ideal points to draw an edge between the two boxes by finding the shortest linear distance between the two.
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
 *   startPoint: { x: number; y: number };
 *   endPoint: { x: number; y: number };
 * }}
 */
export function getIdealBoxSides(startBox, endBox) {
  const startPts = getBoxBounds(startBox);
  const endPts = getBoxBounds(endBox);

  let minDistanceSource = [Infinity, { x: 0, y: 0 }];
  let minDistanceTarget = [Infinity, { x: 0, y: 0 }];

  startPts.forEach(pointA => {
    endPts.forEach(pointB => {
      const distance = euclideanDistance(pointA, pointB);
      if (distance < minDistanceSource[0]) {
        minDistanceSource = [distance, pointA];
      }

      if (distance < minDistanceTarget[0]) {
        minDistanceTarget = [distance, pointB];
      }
    });
  });

  return {
    startPoint: minDistanceSource[1],
    endPoint: minDistanceTarget[1]
  };
}

// Infer if a point is on the left or right side of a box
/**
 * @param {{
 *   x: number;
 *   y: number;
 * }} point
 * @param {{
 *   x: number;
 *   y: number;
 *   w: number;
 * }} box
 * @returns {boolean}
 */
export function isPointOnLeftOrRightSide(point, box) {
  return point.x === box.x || point.x === box.x + box.w;
}
