const getDistance = (posA, posB, min = Infinity, max = Infinity) => {
  const distance = Math.abs(posB - posA);
  if (min !== Infinity && distance < min) {
    return min;
  }

  if (max !== Infinity && distance > max) {
    return max;
  }

  return distance;
};

const calculatePosition = (containerSize, spotSize, step = 1, totalSteps = 1) => {
  let newPos = containerSize * (step / (1 + totalSteps));
  if (newPos < spotSize * step) {
    newPos = spotSize * step;

    if (step > 1 && totalSteps > 1) {
      newPos += 2 * (step - 1);
    }
  }

  return newPos;
};

const angle2Points = (pointA, pointB, isAbsolute = false, offset = 180) => {
  const angle = offset - (Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x) * 180) / Math.PI;
  if (isAbsolute && angle < 0) {
    return angle + 360;
  }

  return angle;
};

export { getDistance, calculatePosition, angle2Points };
