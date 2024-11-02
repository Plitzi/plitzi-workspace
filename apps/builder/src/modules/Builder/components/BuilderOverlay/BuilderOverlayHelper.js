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

const PLACEMENT_TOP = 'top';
const PLACEMENT_BOTTOM = 'bottom';
const PLACEMENT_LEFT = 'left';
const PLACEMENT_RIGHT = 'right';
const placements = [PLACEMENT_TOP, PLACEMENT_BOTTOM, PLACEMENT_LEFT, PLACEMENT_RIGHT];

const calculateQuadrants = (rectSelected, rectHovered) => {
  const cardinals = {};
  const topBottomCentered = rectHovered.left + rectHovered.width / 2 === rectSelected.left + rectSelected.width / 2;
  const leftRightCentered = rectHovered.top + rectHovered.height / 2 === rectSelected.top + rectSelected.height / 2;
  if (rectHovered.top < rectSelected.top || (rectHovered.top > rectSelected.top && leftRightCentered)) {
    cardinals[PLACEMENT_TOP] = { placement: PLACEMENT_TOP, isCentered: topBottomCentered };
  }

  if (rectHovered.bottom > rectSelected.bottom || (rectHovered.bottom < rectSelected.bottom && leftRightCentered)) {
    cardinals[PLACEMENT_BOTTOM] = { placement: PLACEMENT_BOTTOM, isCentered: topBottomCentered };
  }

  if (rectHovered.left < rectSelected.left || (rectHovered.left > rectSelected.left && topBottomCentered)) {
    cardinals[PLACEMENT_LEFT] = { placement: PLACEMENT_LEFT, isCentered: leftRightCentered };
  }

  if (rectHovered.right > rectSelected.right || (rectHovered.right < rectSelected.right && topBottomCentered)) {
    cardinals[PLACEMENT_RIGHT] = { placement: PLACEMENT_RIGHT, isCentered: leftRightCentered };
  }

  return cardinals;
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

const calculateIsOverlaped = (rectSelected, rectHovered, placement) => {
  switch (placement) {
    case PLACEMENT_TOP:
      return rectHovered.top + rectHovered.height > rectSelected.top;
    case PLACEMENT_BOTTOM:
      return rectHovered.top < rectSelected.top;
    case PLACEMENT_LEFT:
      return rectHovered.left + rectHovered.width > rectSelected.left;
    case PLACEMENT_RIGHT:
      return rectHovered.left < rectSelected.right;
    default:
      return false;
  }
};

const borderSize = 2;

// Distance

const calculateDistanceTop = (rectSelected, rectHovered, value, sameQuadrant = false) => {
  if (sameQuadrant && !calculateIsOverlaped(rectSelected, rectHovered, PLACEMENT_TOP)) {
    value = value - rectHovered?.height;
  }

  if (rectSelected.top < rectHovered.top) {
    return {
      position: {
        top: rectHovered.top - value,
        left: rectHovered.left + rectHovered.width / 2,
        width: borderSize,
        height: value
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.top - value,
      left: rectSelected.left + rectSelected.width / 2,
      width: borderSize,
      height: value
    },
    value
  };
};

const calculateDistanceBottom = (rectSelected, rectHovered, value, sameQuadrant = false) => {
  if (sameQuadrant) {
    value = value - rectHovered?.height;
  }

  if (rectSelected.bottom > rectHovered.bottom) {
    return {
      position: {
        top: rectHovered.top + rectHovered.height,
        left: rectHovered.left + rectHovered.width / 2,
        width: borderSize,
        height: value
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.top + rectSelected.height,
      left: rectSelected.left + rectSelected.width / 2,
      width: borderSize,
      height: value
    },
    value
  };
};

const calculateDistanceLeft = (rectSelected, rectHovered, value, sameQuadrant = false) => {
  if (sameQuadrant && !calculateIsOverlaped(rectSelected, rectHovered, PLACEMENT_LEFT)) {
    value = value - rectHovered?.width;
  }

  if (rectSelected.left < rectHovered.left) {
    return {
      position: {
        top: rectHovered.top + rectHovered.height / 2,
        left: rectSelected.left,
        width: value,
        height: borderSize
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.top + rectSelected.height / 2,
      left: rectSelected.left - value,
      width: value,
      height: borderSize
    },
    value
  };
};

const calculateDistanceRight = (rectSelected, rectHovered, value, sameQuadrant = false) => {
  if (sameQuadrant && !calculateIsOverlaped(rectSelected, rectHovered, PLACEMENT_RIGHT)) {
    value = value - rectHovered?.width;
  }

  if (rectSelected.right > rectHovered.right) {
    return {
      position: {
        top: rectHovered.top + rectHovered.height / 2,
        left: rectSelected.right > rectHovered.right ? rectHovered.right : rectSelected.right,
        width: value,
        height: borderSize
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.top + rectSelected.height / 2,
      left: rectHovered.right > rectSelected.right ? rectSelected.right : rectHovered.right,
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

const calculateDistance = (placement, rectSelected, rectHovered, quadrants = {}, isInside = false) => {
  if (!quadrants || !quadrants.length) {
    quadrants = calculateQuadrants(rectSelected, rectHovered);
  }

  const isCentered = quadrants[placement].isCentered;
  const sameQuadrant =
    !!quadrants[placement] &&
    !isInside &&
    (!Object.values(quadrants).find(quadrant => quadrant.isCentered) || isCentered);
  let value = calculateDelta(rectSelected?.[placement], rectHovered?.[placement]);
  let position = { top: 0, left: 0, width: 0, height: 0 };
  ({ position, value } = distanceFn[placement](rectSelected, rectHovered, value, sameQuadrant));

  return { placement, position, value: Math.abs(value), isCentered };
};

const calculateDistances = (rectSelected, rectHovered) => {
  if (!rectHovered || !rectSelected) {
    return { distances: [], projections: [] };
  }

  const quadrants = calculateQuadrants(rectSelected, rectHovered);
  const isInside = calculateIsInside(rectSelected, rectHovered) || calculateIsInside(rectHovered, rectSelected);
  console.log(quadrants, isInside);
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

// pos initial = (x1, y1)
// pos end = (x2, y2)
// angle (y2 - y1) / (x2 - x1)

const calculateProjectionTop = (rectSelected, rectHovered, value, distancesObj) => {
  const distanceLeft = distancesObj[PLACEMENT_LEFT]?.value;
  let left = rectSelected.centerX;
  let deltaX = 0;
  if (distanceLeft) {
    deltaX = calculateDelta(rectHovered.right, rectSelected.centerX);
    left -= deltaX;
  } else {
    deltaX = calculateDelta(rectSelected.centerX, rectHovered.left);
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
  let left = rectSelected.centerX;
  let deltaX = 0;
  if (distanceLeft) {
    deltaX = calculateDelta(rectHovered.right, rectSelected.centerX);
    left -= deltaX;
  } else {
    deltaX = calculateDelta(rectSelected.centerX, rectHovered.left);
  }

  return {
    position: {
      top: rectSelected.bottom + value,
      left,
      width: deltaX,
      height: borderSize
    }
  };
};

const calculateProjectionLeft = (rectSelected, rectHovered, value, distancesObj) => {
  const distanceTop = distancesObj[PLACEMENT_TOP]?.value;
  let top = rectSelected.centerY;
  let deltaY = 0;
  if (distanceTop) {
    deltaY = calculateDelta(rectHovered.bottom, rectSelected.centerY);
    top -= deltaY;
  } else {
    deltaY = calculateDelta(rectSelected.centerY, rectHovered.top);
  }

  return {
    position: {
      top,
      left: rectSelected.left - value,
      width: borderSize,
      height: deltaY
    }
  };
};

const calculateProjectionRight = (rectSelected, rectHovered, value, distancesObj) => {
  const distanceTop = distancesObj[PLACEMENT_TOP]?.value;
  let top = rectSelected.centerY;
  let deltaY = 0;
  if (distanceTop) {
    deltaY = calculateDelta(rectHovered.bottom, rectSelected.centerY);
    top -= deltaY;
  } else {
    deltaY = calculateDelta(rectSelected.centerY, rectHovered.top);
  }

  return {
    position: {
      top,
      left: rectSelected.right + value,
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

  return distances
    .filter(distance => !distance.isCentered)
    .map(distance => projectionFn[distance.placement](rectSelected, rectHovered, distance.value, distancesObj));
};

export {
  processContainer,
  calculateIsInside,
  calculateDistance,
  calculateDistances,
  processContainerDistance,
  calculateProjections
};
