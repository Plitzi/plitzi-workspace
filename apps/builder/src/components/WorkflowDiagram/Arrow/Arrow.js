// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Relatives
import { getCubicBezierSVGPath } from './helpers/path';
import { interpolateCubicBezierAngle } from './helpers/interpolation';
import { getDistance } from '../helpers/workflowUtils';
import { getCurveHorizontal, getCurveVertical } from './helpers/arrowUtils';

/**
 * @param {{
 *   className?: string;
 *   direction?: 'horizontal' | 'vertical';
 *   dotRadius?: number;
 *   fromRadius?: number;
 *   curveRate?: number;
 *   fromX?: number;
 *   fromY?: number;
 *   toX?: number;
 *   toY?: number;
 *   offsetX?: number;
 *   offsetY?: number;
 *   isPreview?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const Arrow = props => {
  const {
    className = '',
    direction = 'horizontal',
    dotRadius = 8,
    fromRadius = 4,
    curveRate = 0.75,
    fromX = 128,
    fromY = 128,
    toX = 256,
    toY = 256,
    offsetX = 0,
    offsetY = 0,
    isPreview = false,
    ...otherProps
  } = props;
  const width = getDistance(fromX, toX);
  const height = getDistance(fromY, toY);

  const curve = useMemo(() => {
    switch (direction) {
      case 'vertical':
        return getCurveVertical(
          { x: fromX, y: fromY },
          { x: toX, y: toY },
          width,
          height,
          dotRadius,
          curveRate,
          isPreview
        );

      case 'horizontal':
      default:
        return getCurveHorizontal(
          { x: fromX, y: fromY },
          { x: toX, y: toY },
          width,
          height,
          dotRadius,
          curveRate,
          isPreview
        );
    }
  }, [direction, fromRadius, fromX, fromY, toX, toY, dotRadius, isPreview]);
  const svgPath = useMemo(() => getCubicBezierSVGPath(curve), [curve]);
  const endAngle = useMemo(() => interpolateCubicBezierAngle(curve, 1), [curve]);

  return (
    <svg
      className={classNames('absolute stroke-gray-500 fill-gray-500', className)}
      viewBox={`0 0 ${width + dotRadius * 2} ${height + dotRadius * 2}`}
      style={{
        width: width + dotRadius * 2,
        height: height + dotRadius * 2,
        top: (fromY > toY ? toY - dotRadius : fromY - dotRadius) + offsetY,
        left: (fromX > toX ? toX - dotRadius : fromX - dotRadius) + offsetX
      }}
      strokeWidth={3}
      {...otherProps}
    >
      <circle cx={curve.start.x} cy={curve.start.y} r={fromRadius} />
      <path
        d={svgPath}
        fill="none"
        className="animate-[dashdraw_0.5s_linear_infinite]"
        style={{ strokeDasharray: 5 }}
      />
      <polygon points="0,-6 12,0, 0,6" transform={`translate(${curve.end.x},${curve.end.y}) rotate(${endAngle})`} />
    </svg>
  );
};

export default Arrow;
