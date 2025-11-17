import { getCurve } from './path';
import { angle2Points } from '../../../helpers/workflowUtils';

const getFromPosition = (
  fromPoint: { x: number; y: number },
  toPoint: { x: number; y: number },
  width: number,
  height: number,
  dotRadius: number
) => {
  const { x: fromX, y: fromY } = fromPoint;
  const { x: toX, y: toY } = toPoint;
  const fromPosition = { x: 0, y: 0 };
  if (fromX >= toX) {
    fromPosition.x = width + dotRadius;
  } else {
    fromPosition.x = dotRadius;
  }

  if (fromY >= toY) {
    fromPosition.y = height + dotRadius;
  } else {
    fromPosition.y = dotRadius;
  }

  return fromPosition;
};

const getCurveHorizontal = (
  fromPoint: { x: number; y: number },
  toPoint: { x: number; y: number },
  width: number,
  height: number,
  dotRadius: number = 8,
  curveRate: number = 0.75,
  isPreview: boolean = false
) => {
  const fromPosition = getFromPosition(fromPoint, toPoint, width, height, dotRadius);
  const { x: fromX, y: fromY } = fromPoint;
  const { x: toX, y: toY } = toPoint;
  let toPosition = { x: 0, y: 0 };
  let flip = false;
  const angle = angle2Points({ x: toX, y: toY }, { x: fromX, y: fromY }, true);
  const cuadrante = Math.ceil(angle / 45);
  if (isPreview) {
    flip = Math.ceil((angle - 45) / 90) % 2 === 0;
    switch (cuadrante) {
      case 0:
      case 1:
        toPosition = { x: width, y: dotRadius };
        break;
      case 2:
        toPosition = { x: width + dotRadius, y: dotRadius * 2 };
        break;
      case 3:
        toPosition = { x: dotRadius, y: dotRadius * 2 };
        break;
      case 4:
        toPosition = { x: dotRadius * 2, y: dotRadius };
        break;
      case 5:
        toPosition = { x: dotRadius * 2, y: height + dotRadius };
        break;
      case 6:
        toPosition = { x: dotRadius, y: height };
        break;
      case 7:
        toPosition = { x: width + dotRadius, y: height };
        break;
      case 8:
        toPosition = { x: width, y: height + dotRadius };
        break;
      default:
    }
  } else {
    flip = Math.ceil((angle - 90) / 180) % 2 === 0;
    switch (cuadrante) {
      case 0:
      case 1:
        toPosition = { x: width - dotRadius * 2, y: dotRadius };
        break;
      case 2:
        toPosition = { x: width - dotRadius * 2, y: dotRadius };
        if (width < dotRadius * 4) {
          // Special case when the width is too small
          toPosition = { x: width + dotRadius, y: dotRadius * 4 };
          flip = false;
        }

        break;
      case 3:
        toPosition = { x: dotRadius, y: dotRadius * 4 };
        break;
      case 4:
        toPosition = { x: dotRadius, y: dotRadius * 4 };
        break;
      case 5:
        toPosition = { x: dotRadius, y: height - dotRadius * 2 };
        break;
      case 6:
        toPosition = { x: dotRadius, y: height - dotRadius * 2 };
        break;
      case 7:
        toPosition = { x: width - dotRadius * 2, y: height + dotRadius };
        if (width < dotRadius * 4) {
          // Special case when the width is too small
          toPosition = { x: width + dotRadius, y: height - dotRadius * 2 };
          flip = false;
        }

        break;
      case 8:
        toPosition = { x: width - dotRadius * 2, y: height + dotRadius };
        break;
      default:
    }
  }

  return getCurve(fromPosition, toPosition, { flip }, curveRate);
};

const getCurveVertical = (
  fromPoint: { x: number; y: number },
  toPoint: { x: number; y: number },
  width: number,
  height: number,
  dotRadius: number = 8,
  curveRate: number = 0.75,
  isPreview: boolean = false
) => {
  const fromPosition = getFromPosition(fromPoint, toPoint, width, height, dotRadius);
  const { x: fromX, y: fromY } = fromPoint;
  const { x: toX, y: toY } = toPoint;
  let toPosition = { x: 0, y: 0 };
  let flip = false;
  const angle = angle2Points({ x: toX, y: toY }, { x: fromX, y: fromY }, true);
  const cuadrante = Math.ceil(angle / 45);
  if (isPreview) {
    flip = cuadrante <= 4;
    switch (cuadrante) {
      case 1:
      case 2:
        toPosition = { x: width - dotRadius, y: dotRadius * 2 };
        if (width < dotRadius * 4) {
          toPosition.x = dotRadius;
        }

        break;
      case 3:
      case 4:
        toPosition = { x: dotRadius * 4, y: dotRadius * 2 };
        if (width < dotRadius * 4) {
          toPosition.x = width;
        }

        break;
      case 5:
      case 6:
        toPosition = { x: dotRadius, y: height - dotRadius };
        break;
      case 7:
      case 8:
        toPosition = { x: width + dotRadius, y: height - dotRadius };
        break;
      default:
    }
  } else {
    flip = cuadrante <= 4;
    switch (cuadrante) {
      case 1:
      case 2:
        toPosition = { x: width - dotRadius * 2, y: dotRadius };
        break;
      case 3:
      case 4:
        toPosition = { x: dotRadius * 4, y: dotRadius };
        break;
      case 5:
      case 6:
        toPosition = { x: dotRadius, y: height - dotRadius * 2 };
        break;
      case 7:
      case 8:
        toPosition = { x: width + dotRadius, y: height - dotRadius * 2 };
        break;
      default:
    }
  }

  return getCurve(fromPosition, toPosition, { flip }, curveRate);
};

export { getCurveHorizontal, getCurveVertical };
