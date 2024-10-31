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

  return { top: y, bottom: y + height, left: x, right: x + width, width, height };
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

const borderSize = 2;

// Distance

const calculateDistanceTop = (rectSelected, rectHovered, value, sameQuadrant = false) => {
  if (sameQuadrant) {
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
  if (sameQuadrant) {
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
  if (sameQuadrant) {
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
  let value = parseFloat(Math.abs((rectSelected?.[placement] ?? 0) - (rectHovered?.[placement] ?? 0)));
  let position = { top: 0, left: 0, width: 0, height: 0 };
  ({ position, value } = distanceFn[placement](rectSelected, rectHovered, value, sameQuadrant));

  return { placement, position, value: Math.abs(value), isCentered };
};

const calculateDistances = (rectSelected, rectHovered) => {
  if (!rectHovered || !rectSelected) {
    return { distances: [], projections: [] };
  }

  const quadrants = calculateQuadrants(rectSelected, rectHovered);
  const isInside = calculateIsInside(rectSelected, rectHovered);
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
  const distanceRight = distancesObj[PLACEMENT_RIGHT]?.value;
  const width = distanceLeft ?? distanceRight ?? 0;
  if (rectSelected.top < rectHovered.top) {
    return {
      position: {
        top: rectHovered.top - value,
        left: distanceLeft ? rectHovered.left + rectHovered.width / 2 : rectSelected.right,
        width: width + rectHovered.width / 2 + borderSize,
        height: borderSize
      }
    };
  }

  return {
    position: {
      top: rectSelected.top - value - borderSize,
      left: distanceLeft ? rectSelected.left - distanceLeft : rectSelected.left + rectSelected.width / 2,
      width: width + rectSelected.width / 2 + borderSize,
      height: borderSize
    }
  };
};

const calculateProjectionBottom = (rectSelected, rectHovered, value, distancesObj) => {
  const distanceLeft = distancesObj[PLACEMENT_LEFT]?.value;
  const distanceRight = distancesObj[PLACEMENT_RIGHT]?.value;
  const width = distanceLeft ?? distanceRight ?? 0;
  if (rectSelected.bottom > rectHovered.bottom) {
    return {
      position: {
        top: rectHovered.bottom + value - borderSize,
        left: distanceLeft ? rectHovered.left + rectHovered.width / 2 : rectSelected.right,
        width: width + rectHovered.width / 2 + borderSize,
        height: borderSize
      }
    };
  }

  return {
    position: {
      top: rectSelected.bottom + value,
      left: distanceLeft ? rectSelected.left - distanceLeft : rectSelected.left + rectSelected.width / 2,
      width: width + rectSelected.width / 2 + borderSize,
      height: borderSize
    }
  };
};

const calculateProjectionLeft = (rectSelected, rectHovered, value, distancesObj) => {
  const distanceTop = distancesObj[PLACEMENT_TOP]?.value;
  const distanceBottom = distancesObj[PLACEMENT_BOTTOM]?.value;
  const height = distanceTop ?? distanceBottom ?? 0;
  if (rectSelected.left < rectHovered.left) {
    return {
      position: {
        top: distanceTop ? rectHovered.top + rectHovered.height / 2 : rectSelected.bottom,
        left: rectHovered.left - value,
        width: borderSize,
        height: height + rectHovered.height / 2 + borderSize
      }
    };
  }

  return {
    position: {
      top: distanceTop ? rectSelected.top - distanceTop : rectSelected.top + rectSelected.height / 2,
      left: rectSelected.left - value,
      width: borderSize,
      height: height + rectSelected.height / 2 + borderSize
    }
  };
};

const calculateProjectionRight = (rectSelected, rectHovered, value, distancesObj) => {
  const distanceTop = distancesObj[PLACEMENT_TOP]?.value;
  const distanceBottom = distancesObj[PLACEMENT_BOTTOM]?.value;
  const height = distanceTop ?? distanceBottom ?? 0;
  if (rectSelected.right > rectHovered.right) {
    return {
      position: {
        top: distanceTop ? rectHovered.top + rectHovered.height / 2 : rectSelected.bottom,
        left: rectHovered.right + value - borderSize,
        width: borderSize,
        height: height + rectHovered.height / 2 + borderSize
      }
    };
  }

  return {
    position: {
      top: distanceTop ? rectSelected.top - distanceTop : rectSelected.top + rectSelected.height / 2,
      left: rectSelected.right + value - borderSize,
      width: borderSize,
      height: height + rectSelected.height / 2 + borderSize
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
