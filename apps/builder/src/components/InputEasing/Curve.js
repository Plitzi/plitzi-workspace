// Packages
import React from 'react';

const valueDefault = [];

const Curve = props => {
  const { value = valueDefault, xFrom = 0, xTo = 0, yFrom = 0, yTo = 0 } = props;

  const interp = (a, b, x) => a * (1 - x) + b * x;

  const x = value => Math.round(interp(xFrom, xTo, value));

  const y = value => Math.round(interp(yFrom, yTo, value));

  const sx = x(0);
  const sy = y(0);
  const ex = x(1);
  const ey = y(1);
  const cx1 = x(value[0]);
  const cy1 = y(value[1]);
  const cx2 = x(value[2]);
  const cy2 = y(value[3]);

  return (
    <path
      className="fill-transparent stroke-gray-900 stroke-2"
      d={`M${sx},${sy} C${cx1},${cy1} ${cx2},${cy2} ${ex},${ey}`}
    />
  );
};

export default Curve;
