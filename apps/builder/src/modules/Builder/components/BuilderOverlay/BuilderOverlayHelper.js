const processContainer = (elementDOM, iframeDOM, zoom) => {
  let scrollY = 0;
  let scrollX = 0;
  let innerHeight = 0;
  let innerWidth = 0;
  if (iframeDOM) {
    ({ scrollY, innerHeight, innerWidth } = iframeDOM.contentWindow);
    const [{ scrollLeft, scrollTop }] = iframeDOM.contentWindow.document.getElementsByClassName('builder-iframe');
    if (scrollLeft !== 0 && scrollX === 0) {
      scrollX = scrollLeft;
    }

    if (scrollTop !== 0 && scrollY === 0) {
      scrollY = scrollTop;
    }
  } else {
    ({ scrollX, scrollY, innerHeight, innerWidth } = window);
  }

  if (!elementDOM) {
    return;
  }

  const { width, height, top, left } = elementDOM.getBoundingClientRect();

  return {
    width: width / zoom,
    height: height / zoom,
    x: (left + scrollX) / zoom,
    y: (top + scrollY) / zoom,
    scrollX,
    scrollY,
    innerHeight: innerHeight / zoom,
    innerWidth: innerWidth / zoom,
    rounded: {
      width: Math.round(width),
      height: Math.round(height)
    }
  };
};

const processContainerDistance = (elementDOM, iframeDOM, zoom) => {
  if (!elementDOM) {
    return;
  }

  const container = processContainer(elementDOM, iframeDOM, zoom);
  if (!container) {
    return;
  }

  const { width, height, x, y } = container;

  return {
    top: y,
    bottom: y + height,
    left: x,
    right: x + width,
    centerX: x + width / 2,
    centerY: y + height / 2,
    width,
    height
  };
};

// Distance - Helpers

const borderSize = 2;

const PLACEMENT_TOP = 'top';
const PLACEMENT_BOTTOM = 'bottom';
const PLACEMENT_LEFT = 'left';
const PLACEMENT_RIGHT = 'right';
const placements = [PLACEMENT_TOP, PLACEMENT_BOTTOM, PLACEMENT_LEFT, PLACEMENT_RIGHT];

const calculateIsOverlaped = (rectSelected, rectHovered, placement, fullOverlapping = false) => {
  const overlapLeft = Math.max(rectSelected.left, rectHovered.left);
  const overlapRight = Math.min(rectSelected.right, rectHovered.right);
  const overlapTop = Math.max(rectSelected.top, rectHovered.top);
  const overlapBottom = Math.min(rectSelected.bottom, rectHovered.bottom);

  let isOverlapping = false;
  if (fullOverlapping) {
    isOverlapping = overlapLeft < overlapRight && overlapTop < overlapBottom;
  } else {
    isOverlapping =
      (overlapLeft < overlapRight && [PLACEMENT_LEFT, PLACEMENT_RIGHT].includes(placement)) ||
      (overlapTop < overlapBottom && [PLACEMENT_TOP, PLACEMENT_BOTTOM].includes(placement));
  }

  return isOverlapping;
};

const calculateQuadrants = (rectSelected, rectHovered, isInside = false) => {
  const quadrants = {};
  const isOverlapedTop = calculateIsOverlaped(rectSelected, rectHovered, PLACEMENT_TOP);
  if (rectSelected.centerY > rectHovered.bottom || isOverlapedTop || isInside) {
    quadrants[PLACEMENT_TOP] = {
      placement: PLACEMENT_TOP,
      isCentered: rectSelected.centerX === rectHovered.centerX,
      isOverlaped: isOverlapedTop && !isInside
    };
  }

  const isOverlapedBottom = calculateIsOverlaped(rectSelected, rectHovered, PLACEMENT_BOTTOM);
  if (rectSelected.centerY < rectHovered.centerY || isOverlapedBottom || isInside) {
    quadrants[PLACEMENT_BOTTOM] = {
      placement: PLACEMENT_BOTTOM,
      isCentered: rectSelected.centerX === rectHovered.centerX,
      isOverlaped: isOverlapedBottom && !isInside
    };
  }

  const isOverlapedLeft = calculateIsOverlaped(rectSelected, rectHovered, PLACEMENT_LEFT);
  if (rectSelected.centerX > rectHovered.left || isOverlapedLeft || isInside) {
    quadrants[PLACEMENT_LEFT] = {
      placement: PLACEMENT_LEFT,
      isCentered: rectSelected.centerY === rectHovered.centerY,
      isOverlaped: isOverlapedLeft && !isInside
    };
  }

  const isOverlapedRight = calculateIsOverlaped(rectSelected, rectHovered, PLACEMENT_RIGHT);
  if (rectSelected.centerX < rectHovered.right || isOverlapedRight || isInside) {
    quadrants[PLACEMENT_RIGHT] = {
      placement: PLACEMENT_RIGHT,
      isCentered: rectSelected.centerY === rectHovered.centerY,
      isOverlaped: isOverlapedRight && !isInside
    };
  }

  return quadrants;
};

const calculateIsInside = (rectSelected, rectHovered) =>
  rectSelected.left >= rectHovered.left &&
  rectSelected.right <= rectHovered.right &&
  rectSelected.top >= rectHovered.top &&
  rectSelected.bottom <= rectHovered.bottom;

const calculateDelta = (position1 = 0, position2 = 0, absolute = true) => {
  if (absolute) {
    return parseFloat(Math.abs(position1 - position2));
  }

  return parseFloat(position1 - position2);
};

const calculateDeltaVariation = (rectSelected, rectHovered, placement, isInside = false) => {
  let delta = 0;
  let delta1 = 0;
  let delta2 = 0;
  if (isInside) {
    return delta;
  }

  switch (placement) {
    case PLACEMENT_TOP:
    case PLACEMENT_BOTTOM:
      delta1 = calculateDelta(rectSelected.centerX, rectHovered.left);
      delta2 = calculateDelta(rectSelected.centerX, rectHovered.right);
      if (rectSelected.centerY <= rectHovered.right && rectSelected.centerY >= rectHovered.left) {
        delta = 0;
      } else if (delta1 < delta2 && rectSelected.centerX + delta1 <= rectSelected.right) {
        delta = delta1;
      } else if (rectSelected.centerX - delta2 >= rectSelected.left) {
        delta = -delta2 - borderSize;
      }

      break;
    case PLACEMENT_LEFT:
    case PLACEMENT_RIGHT:
      delta1 = calculateDelta(rectSelected.centerY, rectHovered.top);
      delta2 = calculateDelta(rectSelected.centerY, rectHovered.bottom);
      if (rectSelected.centerY <= rectHovered.bottom && rectSelected.centerY >= rectHovered.top) {
        delta = 0;
      } else if (delta1 < delta2 && rectSelected.centerY + delta1 <= rectSelected.bottom) {
        delta = delta1;
      } else if (rectSelected.centerY - delta2 >= rectSelected.top) {
        delta = -delta2 - borderSize;
      }

      break;
    default:
      return delta;
  }

  if (delta1 === delta2) {
    return 0;
  }

  return delta;
};

// Distance

const calculateDistanceTop = (
  rectSelected,
  rectHovered,
  value,
  sameQuadrant = false,
  isOverlaped = false,
  isInside = false
) => {
  if (sameQuadrant && !isOverlaped) {
    value = value - rectHovered?.height;
  }

  if (rectSelected.top < rectHovered.top) {
    return {
      position: {
        top: rectHovered.top - value,
        left: rectHovered.centerX + calculateDeltaVariation(rectHovered, rectSelected, PLACEMENT_TOP, isInside),
        width: borderSize,
        height: value
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.top - value,
      left: rectSelected.centerX + calculateDeltaVariation(rectSelected, rectHovered, PLACEMENT_TOP, isInside),
      width: borderSize,
      height: value
    },
    value
  };
};

const calculateDistanceBottom = (
  rectSelected,
  rectHovered,
  value,
  sameQuadrant = false,
  isOverlaped = false,
  isInside = false
) => {
  if (sameQuadrant && !isOverlaped) {
    value = value - rectHovered?.height;
  }

  if (rectSelected.bottom > rectHovered.bottom) {
    return {
      position: {
        top: rectHovered.bottom,
        left: rectHovered.centerX + calculateDeltaVariation(rectHovered, rectSelected, PLACEMENT_BOTTOM, isInside),
        width: borderSize,
        height: value
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.bottom,
      left: rectSelected.centerX + calculateDeltaVariation(rectSelected, rectHovered, PLACEMENT_BOTTOM, isInside),
      width: borderSize,
      height: value
    },
    value
  };
};

const calculateDistanceLeft = (
  rectSelected,
  rectHovered,
  value,
  sameQuadrant = false,
  isOverlaped = false,
  isInside = false
) => {
  if (sameQuadrant && !isOverlaped) {
    value = value - rectHovered?.width;
  }

  if (rectSelected.left < rectHovered.left) {
    return {
      position: {
        top: rectHovered.centerY + calculateDeltaVariation(rectHovered, rectSelected, PLACEMENT_LEFT, isInside),
        left: rectSelected.left,
        width: value,
        height: borderSize
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.centerY + calculateDeltaVariation(rectSelected, rectHovered, PLACEMENT_LEFT, isInside),
      left: rectSelected.left - value,
      width: value,
      height: borderSize
    },
    value
  };
};

const calculateDistanceRight = (
  rectSelected,
  rectHovered,
  value,
  sameQuadrant = false,
  isOverlaped = false,
  isInside = false
) => {
  if (sameQuadrant && !isOverlaped) {
    value = value - rectHovered?.width;
  }

  if (rectSelected.right > rectHovered.right) {
    return {
      position: {
        top: rectHovered.centerY + calculateDeltaVariation(rectHovered, rectSelected, PLACEMENT_RIGHT, isInside),
        left: rectHovered.right,
        width: value,
        height: borderSize
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.centerY + calculateDeltaVariation(rectSelected, rectHovered, PLACEMENT_RIGHT, isInside),
      left: rectSelected.right,
      width: value,
      height: borderSize
    },
    value
  };
};

const distanceFn = {
  [PLACEMENT_TOP]: calculateDistanceTop,
  [PLACEMENT_BOTTOM]: calculateDistanceBottom,
  [PLACEMENT_LEFT]: calculateDistanceLeft,
  [PLACEMENT_RIGHT]: calculateDistanceRight
};

const calculateDistance = (placement, rectSelected, rectHovered, quadrants, isInside = false) => {
  if (!quadrants || !Object.keys(quadrants).length) {
    quadrants = calculateQuadrants(rectSelected, rectHovered, isInside);
  }

  const { isOverlaped, isCentered } = quadrants[placement];
  const sameQuadrant = !!quadrants[placement] && !isInside;
  let value = calculateDelta(rectSelected?.[placement], rectHovered?.[placement]);
  let position = { top: 0, left: 0, width: 0, height: 0 };
  ({ position, value } = distanceFn[placement](rectSelected, rectHovered, value, sameQuadrant, isOverlaped, isInside));

  return { placement, position, value: Number(Math.abs(value).toFixed(2)), isCentered, isOverlaped };
};

const calculateDistances = (rectSelected, rectHovered) => {
  if (!rectHovered || !rectSelected) {
    return { distances: [], projections: [] };
  }

  const isInside = calculateIsInside(rectSelected, rectHovered) || calculateIsInside(rectHovered, rectSelected);
  const quadrants = calculateQuadrants(rectSelected, rectHovered, isInside);

  const distances = placements
    .filter(placement => !!quadrants[placement])
    .map(placement => calculateDistance(placement, rectSelected, rectHovered, quadrants, isInside))
    .filter(distance => distance.value !== 0);

  if (isInside) {
    return { distances, projections: [] };
  }

  return {
    distances,
    projections: calculateProjections(distances, rectSelected, rectHovered)
  };
};

// Distance - Projection

const calculateProjectionTop = (rectSelected, rectHovered, value, distancesObj) => {
  const distanceLeft = distancesObj[PLACEMENT_LEFT]?.value;
  const selectedIsBigger = rectSelected.top > rectHovered.top;
  let left = 0;
  let deltaX = 0;
  if (distanceLeft && !selectedIsBigger) {
    deltaX = calculateDelta(rectHovered.right, rectSelected.centerX);
    left = rectHovered.bottom;
  } else if (distanceLeft && selectedIsBigger) {
    deltaX = calculateDelta(rectHovered.right, rectSelected.centerX);
    left = rectHovered.right;
  } else if (!selectedIsBigger) {
    deltaX = calculateDelta(rectSelected.right, rectHovered.centerX);
    left = rectSelected.right;
  } else {
    deltaX = calculateDelta(rectSelected.centerX, rectHovered.left);
    left = rectSelected.centerX;
  }

  return {
    position: {
      top: rectSelected.top - value - borderSize,
      left,
      width: deltaX,
      height: borderSize
    }
  };
};

const calculateProjectionBottom = (rectSelected, rectHovered, value, distancesObj) => {
  const distanceLeft = distancesObj[PLACEMENT_LEFT]?.value;
  const selectedIsBigger = rectSelected.bottom < rectHovered.bottom;
  let left = 0;
  let deltaX = 0;
  if (distanceLeft && !selectedIsBigger) {
    deltaX = calculateDelta(rectHovered.right, rectSelected.centerX);
    left = rectHovered.bottom;
  } else if (distanceLeft && selectedIsBigger) {
    deltaX = calculateDelta(rectHovered.right, rectSelected.centerX);
    left = rectHovered.right;
  } else if (!selectedIsBigger) {
    deltaX = calculateDelta(rectSelected.right, rectHovered.centerX);
    left = rectSelected.right;
  } else {
    deltaX = calculateDelta(rectSelected.centerX, rectHovered.left);
    left = rectSelected.centerX;
  }

  return {
    position: {
      top: selectedIsBigger ? rectSelected.bottom + value : rectSelected.bottom - borderSize,
      left,
      width: deltaX,
      height: borderSize
    }
  };
};

const calculateProjectionLeft = (rectSelected, rectHovered, value, distancesObj) => {
  const distanceTop = distancesObj[PLACEMENT_TOP]?.value;
  const selectedIsBigger = rectSelected.left < rectHovered.left;
  let top = 0;
  let deltaY = 0;
  if (distanceTop && !selectedIsBigger) {
    deltaY = calculateDelta(rectHovered.bottom, rectSelected.centerY);
    top = rectHovered.bottom;
  } else if (distanceTop && selectedIsBigger) {
    deltaY = calculateDelta(rectSelected.top, rectHovered.centerY);
    top = rectHovered.centerY;
  } else if (!selectedIsBigger) {
    deltaY = calculateDelta(rectSelected.centerY, rectHovered.top);
    top = rectSelected.centerY;
  } else {
    deltaY = calculateDelta(rectSelected.bottom, rectHovered.centerY);
    top = rectSelected.bottom;
  }

  return {
    position: {
      top,
      left: selectedIsBigger ? rectSelected.left : rectSelected.left - value,
      width: borderSize,
      height: deltaY
    }
  };
};

const calculateProjectionRight = (rectSelected, rectHovered, value, distancesObj) => {
  const distanceTop = distancesObj[PLACEMENT_TOP]?.value;
  const selectedIsBigger = rectSelected.right > rectHovered.right;
  let top = 0;
  let deltaY = 0;
  if (distanceTop && !selectedIsBigger) {
    deltaY = calculateDelta(rectHovered.bottom, rectSelected.centerY);
    top = rectHovered.bottom;
  } else if (distanceTop && selectedIsBigger) {
    deltaY = calculateDelta(rectSelected.top, rectHovered.centerY);
    top = rectHovered.centerY;
  } else if (!selectedIsBigger) {
    deltaY = calculateDelta(rectSelected.centerY, rectHovered.top);
    top = rectSelected.centerY;
  } else {
    deltaY = calculateDelta(rectSelected.bottom, rectHovered.centerY);
    top = rectSelected.bottom;
  }

  return {
    position: {
      top,
      left: selectedIsBigger ? rectSelected.right - borderSize : rectSelected.right + value,
      width: borderSize,
      height: deltaY
    }
  };
};

const projectionFn = {
  [PLACEMENT_TOP]: calculateProjectionTop,
  [PLACEMENT_BOTTOM]: calculateProjectionBottom,
  [PLACEMENT_LEFT]: calculateProjectionLeft,
  [PLACEMENT_RIGHT]: calculateProjectionRight
};

const calculateProjections = (distances = [], rectSelected, rectHovered) => {
  if (distances.length <= 1 || !rectSelected) {
    return [];
  }

  const distancesObj = distances.reduce((acum, distance) => ({ ...acum, [distance.placement]: distance }), {});
  distances = distances.filter(distance => !distance.isCentered);

  return distances
    .filter(distance => distances.length !== 3 || (distances.length === 3 && distance.isOverlaped))
    .map(distance => ({
      ...projectionFn[distance.placement](rectSelected, rectHovered, distance.value, distancesObj),
      placement: distance.placement
    }));
};

export {
  processContainer,
  calculateIsInside,
  calculateDistance,
  calculateDistances,
  processContainerDistance,
  calculateProjections
};
