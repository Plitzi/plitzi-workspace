export type OverlayDistanceRect = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

export type OverlayRect = {
  width: number;
  height: number;
  x: number;
  y: number;
  scrollX: number;
  scrollY: number;
  innerHeight: number;
  innerWidth: number;
  rounded: {
    width: number;
    height: number;
  };
};

export type ContainerPlacement = 'top' | 'bottom' | 'left' | 'right';

export type OverlayQuadrant = {
  placement: ContainerPlacement;
  isCentered: boolean;
  isOverlaped: boolean;
};

export type OverlayPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type OverlayDistance = {
  placement: ContainerPlacement;
  position: OverlayPosition;
  value: number;
  isCentered?: boolean;
  isOverlaped?: boolean;
};

const processContainer = (elementDOM?: HTMLElement, iframeDOM?: HTMLIFrameElement, zoom: number = 1) => {
  let scrollY = 0;
  let scrollX = 0;
  let innerHeight = 0;
  let innerWidth = 0;
  if (iframeDOM && iframeDOM.contentWindow) {
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

const processContainerDistance = (
  elementDOM?: HTMLElement,
  iframeDOM?: HTMLIFrameElement,
  zoom: number = 1
): OverlayDistanceRect | undefined => {
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

// OverlayDistance - Helpers

const borderSize = 2;

const placements: ContainerPlacement[] = ['top', 'bottom', 'left', 'right'];

const calculateIsOverlaped = (
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect,
  placement: ContainerPlacement,
  fullOverlapping = false
) => {
  const overlapLeft = Math.max(rectSelected.left, rectHovered.left);
  const overlapRight = Math.min(rectSelected.right, rectHovered.right);
  const overlapTop = Math.max(rectSelected.top, rectHovered.top);
  const overlapBottom = Math.min(rectSelected.bottom, rectHovered.bottom);

  let isOverlapping = false;
  if (fullOverlapping) {
    isOverlapping = overlapLeft < overlapRight && overlapTop < overlapBottom;
  } else {
    isOverlapping =
      (overlapLeft < overlapRight && ['left', 'right'].includes(placement)) ||
      (overlapTop < overlapBottom && ['top', 'bottom'].includes(placement));
  }

  return isOverlapping;
};

const calculateQuadrants = (
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect,
  isInside: boolean = false
) => {
  const quadrants: Partial<Record<ContainerPlacement, OverlayQuadrant>> = {};
  const isOverlapedTop = calculateIsOverlaped(rectSelected, rectHovered, 'top');
  if (rectSelected.centerY > rectHovered.bottom || isOverlapedTop || isInside) {
    quadrants.top = {
      placement: 'top',
      isCentered: rectSelected.centerX === rectHovered.centerX,
      isOverlaped: isOverlapedTop && !isInside
    };
  }

  const isOverlapedBottom = calculateIsOverlaped(rectSelected, rectHovered, 'bottom');
  if (rectSelected.centerY < rectHovered.centerY || isOverlapedBottom || isInside) {
    quadrants.bottom = {
      placement: 'bottom',
      isCentered: rectSelected.centerX === rectHovered.centerX,
      isOverlaped: isOverlapedBottom && !isInside
    };
  }

  const isOverlapedLeft = calculateIsOverlaped(rectSelected, rectHovered, 'left');
  if (rectSelected.centerX > rectHovered.left || isOverlapedLeft || isInside) {
    quadrants.left = {
      placement: 'left',
      isCentered: rectSelected.centerY === rectHovered.centerY,
      isOverlaped: isOverlapedLeft && !isInside
    };
  }

  const isOverlapedRight = calculateIsOverlaped(rectSelected, rectHovered, 'right');
  if (rectSelected.centerX < rectHovered.right || isOverlapedRight || isInside) {
    quadrants.right = {
      placement: 'right',
      isCentered: rectSelected.centerY === rectHovered.centerY,
      isOverlaped: isOverlapedRight && !isInside
    };
  }

  return quadrants;
};

const calculateIsInside = (rectSelected: OverlayDistanceRect, rectHovered: OverlayDistanceRect) =>
  rectSelected.left >= rectHovered.left &&
  rectSelected.right <= rectHovered.right &&
  rectSelected.top >= rectHovered.top &&
  rectSelected.bottom <= rectHovered.bottom;

const calculateDelta = (position1 = 0, position2 = 0, absolute = true) => {
  if (absolute) {
    return parseFloat(Math.abs(position1 - position2).toString());
  }

  return parseFloat((position1 - position2).toString());
};

const calculateDeltaVariation = (
  rectSelected?: OverlayDistanceRect,
  rectHovered?: OverlayDistanceRect,
  placement?: ContainerPlacement,
  isInside: boolean = false
) => {
  if (!rectSelected || !rectHovered) {
    return 0;
  }

  let delta = 0;
  let delta1 = 0;
  let delta2 = 0;
  if (isInside) {
    return delta;
  }

  switch (placement) {
    case 'top':
    case 'bottom':
      delta1 = calculateDelta(rectSelected.centerX, rectHovered.left);
      delta2 = calculateDelta(rectSelected.centerX, rectHovered.right);
      if (rectSelected.centerY <= rectHovered.right && rectSelected.centerY >= rectHovered.left) {
        delta = 0;
      } else if (delta1 < delta2 && rectSelected.centerX + delta1 <= rectSelected.right) {
        delta = delta1 - borderSize;
      } else if (rectSelected.centerX - delta2 >= rectSelected.left) {
        delta = -delta2 - borderSize;
      }

      break;
    case 'left':
    case 'right':
      delta1 = calculateDelta(rectSelected.centerY, rectHovered.top);
      delta2 = calculateDelta(rectSelected.centerY, rectHovered.bottom);
      if (rectSelected.centerY <= rectHovered.bottom && rectSelected.centerY >= rectHovered.top) {
        delta = 0;
      } else if (delta1 < delta2 && rectSelected.centerY + delta1 <= rectSelected.bottom) {
        delta = delta1 - borderSize;
      } else if (rectSelected.centerY - delta2 >= rectSelected.top) {
        delta = -delta2 - borderSize;
      }

      break;
    default:
      return delta;
  }

  if (Math.floor(delta1) === Math.floor(delta2)) {
    return 0;
  }

  return delta;
};

// OverlayDistance

const calculateDistanceTop = (
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect,
  value: number,
  sameQuadrant: boolean = false,
  isOverlaped: boolean = false,
  isInside: boolean = false
) => {
  if (sameQuadrant && !isOverlaped) {
    value = value - rectHovered.height;
  }

  if (rectSelected.top < rectHovered.top) {
    return {
      position: {
        top: rectHovered.top - value,
        left: rectHovered.centerX + calculateDeltaVariation(rectHovered, rectSelected, 'top', isInside),
        width: borderSize,
        height: value
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.top - value,
      left: rectSelected.centerX + calculateDeltaVariation(rectSelected, rectHovered, 'top', isInside),
      width: borderSize,
      height: value
    },
    value
  };
};

const calculateDistanceBottom = (
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect,
  value: number,
  sameQuadrant: boolean = false,
  isOverlaped: boolean = false,
  isInside: boolean = false
) => {
  if (sameQuadrant && !isOverlaped) {
    value = value - rectHovered.height;
  }

  if (rectSelected.bottom > rectHovered.bottom) {
    return {
      position: {
        top: rectHovered.bottom,
        left: rectHovered.centerX + calculateDeltaVariation(rectHovered, rectSelected, 'bottom', isInside),
        width: borderSize,
        height: value
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.bottom,
      left: rectSelected.centerX + calculateDeltaVariation(rectSelected, rectHovered, 'bottom', isInside),
      width: borderSize,
      height: value
    },
    value
  };
};

const calculateDistanceLeft = (
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect,
  value: number,
  sameQuadrant: boolean = false,
  isOverlaped: boolean = false,
  isInside: boolean = false
) => {
  if (sameQuadrant && !isOverlaped) {
    value = value - rectHovered.width;
  }

  if (rectSelected.left < rectHovered.left) {
    return {
      position: {
        top: rectHovered.centerY + calculateDeltaVariation(rectHovered, rectSelected, 'left', isInside),
        left: rectSelected.left,
        width: value,
        height: borderSize
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.centerY + calculateDeltaVariation(rectSelected, rectHovered, 'left', isInside),
      left: rectSelected.left - value,
      width: value,
      height: borderSize
    },
    value
  };
};

const calculateDistanceRight = (
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect,
  value: number,
  sameQuadrant: boolean = false,
  isOverlaped: boolean = false,
  isInside: boolean = false
) => {
  if (sameQuadrant && !isOverlaped) {
    value = value - rectHovered.width;
  }

  if (rectSelected.right > rectHovered.right) {
    return {
      position: {
        top: rectHovered.centerY + calculateDeltaVariation(rectHovered, rectSelected, 'right', isInside),
        left: rectHovered.right,
        width: value,
        height: borderSize
      },
      value
    };
  }

  return {
    position: {
      top: rectSelected.centerY + calculateDeltaVariation(rectSelected, rectHovered, 'right', isInside),
      left: rectSelected.right,
      width: value,
      height: borderSize
    },
    value
  };
};

const distanceFn: Record<
  ContainerPlacement,
  (
    rectSelected: OverlayDistanceRect,
    rectHovered: OverlayDistanceRect,
    value: number,
    sameQuadrant?: boolean,
    isOverlaped?: boolean,
    isInside?: boolean
  ) => { position: OverlayPosition; value: number }
> = {
  top: calculateDistanceTop,
  bottom: calculateDistanceBottom,
  left: calculateDistanceLeft,
  right: calculateDistanceRight
};

const calculateDistance = (
  placement: ContainerPlacement,
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect,
  quadrants?: Partial<Record<ContainerPlacement, OverlayQuadrant>>,
  isInside: boolean = false
) => {
  if (!quadrants || !Object.keys(quadrants).length) {
    quadrants = calculateQuadrants(rectSelected, rectHovered, isInside);
  }

  const { isOverlaped = false, isCentered = false } = quadrants[placement] ?? {};
  const sameQuadrant = !!quadrants[placement] && !isInside;
  let value = calculateDelta(rectSelected[placement], rectHovered[placement]);
  let position: OverlayPosition = { top: 0, left: 0, width: 0, height: 0 };
  ({ position, value } = distanceFn[placement](rectSelected, rectHovered, value, sameQuadrant, isOverlaped, isInside));

  return { placement, position, value: Number(Math.abs(value).toFixed(2)), isCentered, isOverlaped } as OverlayDistance;
};

const calculateDistances = (rectSelected?: OverlayDistanceRect, rectHovered?: OverlayDistanceRect) => {
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

// OverlayDistance - Projection

const calculateProjectionTop = (
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect,
  value: number,
  distancesObj: Partial<Record<ContainerPlacement, OverlayDistance>>
) => {
  const distanceLeft = distancesObj.left?.value;
  const selectedIsBigger = rectSelected.top > rectHovered.top;
  let left = 0;
  let deltaX = 0;
  if (distanceLeft && !selectedIsBigger) {
    deltaX = calculateDelta(rectHovered.centerX, rectSelected.left);
    left = rectHovered.centerX;
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
      top: selectedIsBigger ? rectSelected.top - value : rectSelected.top,
      left,
      width: deltaX,
      height: borderSize
    }
  };
};

const calculateProjectionBottom = (
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect,
  value: number,
  distancesObj: Partial<Record<ContainerPlacement, OverlayDistance>>
) => {
  const distanceLeft = distancesObj.left?.value;
  const selectedIsBigger = rectSelected.bottom < rectHovered.bottom;
  let left = 0;
  let deltaX = 0;
  if (distanceLeft && !selectedIsBigger) {
    deltaX = calculateDelta(rectHovered.centerX, rectSelected.left);
    left = rectHovered.centerX;
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
      top: selectedIsBigger ? rectSelected.bottom + value : rectSelected.bottom,
      left,
      width: deltaX,
      height: borderSize
    }
  };
};

const calculateProjectionLeft = (
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect,
  value: number,
  distancesObj: Partial<Record<ContainerPlacement, OverlayDistance>>
) => {
  const distanceTop = distancesObj.top?.value;
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

const calculateProjectionRight = (
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect,
  value: number,
  distancesObj: Partial<Record<ContainerPlacement, OverlayDistance>>
) => {
  const distanceTop = distancesObj.top?.value;
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
      left: selectedIsBigger ? rectSelected.right : rectSelected.right + value,
      width: borderSize,
      height: deltaY
    }
  };
};

const projectionFn: Record<
  ContainerPlacement,
  (
    rectSelected: OverlayDistanceRect,
    rectHovered: OverlayDistanceRect,
    value: number,
    distancesObj: Partial<Record<ContainerPlacement, OverlayDistance>>
  ) => { position: OverlayPosition }
> = {
  top: calculateProjectionTop,
  bottom: calculateProjectionBottom,
  left: calculateProjectionLeft,
  right: calculateProjectionRight
};

const calculateProjections = (
  distances: OverlayDistance[] = [],
  rectSelected: OverlayDistanceRect,
  rectHovered: OverlayDistanceRect
) => {
  if (distances.length <= 1) {
    return [];
  }

  // debugger;
  const distancesObj: Partial<Record<ContainerPlacement, OverlayDistance>> = distances.reduce(
    (acum, distance) => ({ ...acum, [distance.placement]: distance }),
    {}
  );
  distances = distances.filter(distance => !distance.isCentered);
  const hasOverlaped = distances.find(distance => distance.isOverlaped);

  return distances
    .filter(distance => !hasOverlaped || distance.isOverlaped)
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
