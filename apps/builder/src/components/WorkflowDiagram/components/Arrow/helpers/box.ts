// Get a list of points set up at the center of every side of the box (left, right, top, bottom)
export function getBoxBounds(box: { x: number; y: number; h: number; w: number }) {
  return [
    { x: box.x, y: box.y + box.h / 2 }, // left
    { x: box.x + box.w, y: box.y + box.h / 2 }, // right
    { x: box.x + box.w / 2, y: box.y }, // top
    { x: box.x + box.w / 2, y: box.y + box.h } // bottom
  ];
}

export function euclideanDistance(pointA: { x: number; y: number }, pointB: { x: number; y: number }) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

export function xDistance(pointA: { x: number; y: number }, pointB: { x: number; y: number }) {
  return Math.abs(pointA.x - pointB.x);
}

export function yDistance(pointA: { x: number; y: number }, pointB: { x: number; y: number }) {
  return Math.abs(pointA.y - pointB.y);
}

// Find the ideal points to draw an edge between the two boxes by finding the shortest linear distance between the two.
export function getIdealBoxSides(
  startBox: { x: number; y: number; h: number; w: number },
  endBox: { x: number; y: number; h: number; w: number }
) {
  const startPts = getBoxBounds(startBox);
  const endPts = getBoxBounds(endBox);

  let minDistanceSource: [number, { x: number; y: number }] = [Infinity, { x: 0, y: 0 }];
  let minDistanceTarget: [number, { x: number; y: number }] = [Infinity, { x: 0, y: 0 }];

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
export function isPointOnLeftOrRightSide(
  point: { x: number; y: number },
  box: { x: number; y: number; h: number; w: number }
) {
  return point.x === box.x || point.x === box.x + box.w;
}
