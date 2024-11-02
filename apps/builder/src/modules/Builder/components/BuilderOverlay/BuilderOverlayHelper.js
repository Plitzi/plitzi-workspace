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

const calculateIsOverlaped = (rectSelected, rectHovered, placement) => {
  // const overlapLeft = Math.max(rectSelected.left, rectHovered.left);
  // const overlapRight = Math.min(rectSelected.right, rectHovered.right);
  // const overlapTop = Math.max(rectSelected.top, rectHovered.top);
  // const overlapBottom = Math.min(rectSelected.bottom, rectHovered.bottom);

  // // overlap inside &&, overlap external ||
  // const isOverlapping = overlapLeft < overlapRight && overlapTop < overlapBottom;
  // console.log(isOverlapping);
  // if (!isOverlapping) {
  //   return false;
  // }

  // switch (placement) {
  //   case PLACEMENT_TOP:
  //     return overlapBottom <= rectSelected.centerY;
  //   case PLACEMENT_BOTTOM:
  //     return overlapTop >= rectSelected.centerY;
  //   case PLACEMENT_LEFT:
  //     return overlapRight <= rectSelected.centerX;
  //   case PLACEMENT_RIGHT:
  //     return overlapLeft >= rectSelected.centerX;
  //   default:
  //     return false;
  // }
  switch (placement) {
    case PLACEMENT_TOP:
      return rectHovered.bottom > rectSelected.top;
    case PLACEMENT_BOTTOM:
      return rectHovered.top < rectSelected.top;
    case PLACEMENT_LEFT:
      return rectHovered.right > rectSelected.left;
    case PLACEMENT_RIGHT:
      return rectHovered.left < rectSelected.right;
    default:
      return false;
  }
};

const calculateQuadrants = (rectSelected, rectHovered, isInside = false) => {
  const quadrants = {};
  // const isOverlapedTop = calculateIsOverlaped(rectSelected, rectHovered, PLACEMENT_TOP);
  const isOverlapedTop = rectSelected.centerY > rectHovered.centerY && rectSelected.centerY > rectHovered.top;
  if (rectSelected.centerY > rectHovered.bottom || isOverlapedTop || isInside) {
    quadrants[PLACEMENT_TOP] = {
      placement: PLACEMENT_TOP,
      isCentered: rectSelected.centerX === rectHovered.centerX,
      isOverlaped: isOverlapedTop
    };
  }

  // const isOverlapedBottom = calculateIsOverlaped(rectSelected, rectHovered, PLACEMENT_BOTTOM);
  const isOverlapedBottom = rectSelected.centerY > rectHovered.centerY && rectSelected.centerY < rectHovered.bottom;
  if (rectSelected.centerY < rectHovered.centerY || isOverlapedBottom || isInside) {
    quadrants[PLACEMENT_BOTTOM] = {
      placement: PLACEMENT_BOTTOM,
      isCentered: rectSelected.centerX === rectHovered.centerX,
      isOverlaped: isOverlapedBottom
    };
  }

  // const isOverlapedLeft = calculateIsOverlaped(rectSelected, rectHovered, PLACEMENT_LEFT);
  const isOverlapedLeft = false;
  if (rectSelected.centerX > rectHovered.left || isOverlapedLeft || isInside) {
    quadrants[PLACEMENT_LEFT] = {
      placement: PLACEMENT_LEFT,
      isCentered: rectSelected.centerY === rectHovered.centerY,
      isOverlaped: isOverlapedLeft
    };
  }

  // const isOverlapedRight = calculateIsOverlaped(rectSelected, rectHovered, PLACEMENT_RIGHT);
  const isOverlapedRight = false;
  if (rectSelected.centerX < rectHovered.right || isOverlapedRight || isInside) {
    quadrants[PLACEMENT_RIGHT] = {
      placement: PLACEMENT_RIGHT,
      isCentered: rectSelected.centerY === rectHovered.centerY,
      isOverlaped: isOverlapedRight
    };
  }

  console.log(quadrants);

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

const borderSize = 2;

// Distance

const calculateDistanceTop = (rectSelected, rectHovered, value, sameQuadrant = false, isOverlaped = false) => {
  if (sameQuadrant && !isOverlaped) {
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

const calculateDistanceBottom = (rectSelected, rectHovered, value, sameQuadrant = false, isOverlaped = false) => {
  if (sameQuadrant && !isOverlaped) {
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

const calculateDistanceLeft = (rectSelected, rectHovered, value, sameQuadrant = false, isOverlaped = false) => {
  if (sameQuadrant && !isOverlaped) {
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

const calculateDistanceRight = (rectSelected, rectHovered, value, sameQuadrant = false, isOverlaped = false) => {
  if (sameQuadrant && !isOverlaped) {
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

const calculateDistance = (placement, rectSelected, rectHovered, quadrants, isInside = false) => {
  if (!quadrants || !Object.keys(quadrants).length) {
    quadrants = calculateQuadrants(rectSelected, rectHovered, isInside);
  }

  const sameQuadrant = quadrants[placement] && !isInside;
  const isOverlaped = calculateIsOverlaped(rectSelected, rectHovered, placement);
  let value = calculateDelta(rectSelected?.[placement], rectHovered?.[placement]);
  let position = { top: 0, left: 0, width: 0, height: 0 };
  ({ position, value } = distanceFn[placement](rectSelected, rectHovered, value, sameQuadrant, isOverlaped));

  return {
    placement,
    position,
    value: Math.abs(value),
    isCentered: quadrants[placement].isCentered,
    isOverlaped: quadrants[placement].isOverlaped
  };
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
