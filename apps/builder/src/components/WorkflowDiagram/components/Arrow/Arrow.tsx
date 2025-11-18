import classNames from 'classnames';
import { useMemo } from 'react';

import { ConnectionLineType, Position } from '../../types';
import { getBezierPath } from './helpers/getBezierPath';
import { getSimpleBezierPath } from './helpers/getSimpleBezierPath';
import { getSmoothStepPath } from './helpers/getSmoothStepPath';
import { getStraightPath } from './helpers/getStraightPath';

export type ArrowProps = {
  className?: string;
  direction?: 'horizontal' | 'vertical';
  type?: ConnectionLineType;
  // dotRadius?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  onDoubleClick?: () => void;
};

const Arrow = ({
  className = '',
  direction = 'horizontal',
  type = ConnectionLineType.Bezier,
  // dotRadius = 8,
  fromX = 128,
  fromY = 128,
  toX = 256,
  toY = 256,
  onDoubleClick,
  ...otherProps
}: ArrowProps) => {
  const svgPath = useMemo(() => {
    const params = {
      sourceX: fromX,
      sourceY: fromY,
      targetX: toX,
      targetY: toY,
      sourcePosition: direction === 'horizontal' ? Position.Right : Position.Bottom,
      targetPosition: direction === 'horizontal' ? Position.Left : Position.Top
    };
    switch (type) {
      case ConnectionLineType.Bezier:
        return getBezierPath({ ...params, curvature: 0 });
      case ConnectionLineType.Step:
        return getSmoothStepPath({ ...params, borderRadius: 0 });
      case ConnectionLineType.SmoothStep:
        return getSmoothStepPath(params);
      case ConnectionLineType.SimpleBezier:
        return getSimpleBezierPath(params);

      default:
        return getStraightPath(params);
    }
  }, [direction, fromX, fromY, toX, toY, type]);

  return (
    <svg
      className={classNames(
        'pointer-events-none absolute z-1 overflow-visible fill-gray-500 stroke-gray-500',
        className
      )}
      strokeWidth={2}
      {...otherProps}
    >
      <path
        d={svgPath[0]}
        fill="none"
        className="pointer-events-auto z-10 animate-[dashdraw_0.5s_linear_infinite]"
        style={{ strokeDasharray: 5 }}
        onClick={() => console.log('hey')}
        onDoubleClick={onDoubleClick}
      />
    </svg>
  );
};

export default Arrow;
