// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

// Relatives
import BezierEasing from './BezierEasing';

const valueDefault = [];

const Progress = props => {
  const { progress = 0, xFrom = 0, xTo = 0, yFrom = 0, yTo = 0, value = valueDefault } = props;
  const easing = useMemo(() => BezierEasing(...value), [value]);

  const interp = (a, b, x) => a * (1 - x) + b * x;

  const x = value => Math.round(interp(xFrom, xTo, value));

  const y = value => Math.round(interp(yFrom, yTo, value));

  if (!progress) {
    return <path />;
  }

  const sx = x(0);
  const sy = y(0);
  const px = x(progress);
  const py = y(easing ? easing(progress) : 0);
  const prog = `M${px},${sy} L${px},${py} L${sx},${py}`;

  return <path className="fill-transparent stroke-1 stroke-blue-400" d={prog} />;
};

Progress.propTypes = {
  value: PropTypes.array,
  progress: PropTypes.number,
  xFrom: PropTypes.number,
  yFrom: PropTypes.number,
  xTo: PropTypes.number,
  yTo: PropTypes.number
};

export default Progress;
