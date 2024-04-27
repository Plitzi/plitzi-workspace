// Packages
import React from 'react';

const Grid = props => {
  const { xFrom = 0, xTo = 0, yFrom = 0, yTo = 0 } = props;

  const interp = (a, b, x) => {
    return a * (1 - x) + b * x;
  };

  const x = value => Math.round(interp(xFrom, xTo, value));

  const y = value => Math.round(interp(yFrom, yTo, value));

  const range = (from, to, step) => {
    const t = [];
    for (let i = from; i < to; i += step) {
      t.push(i);
    }

    return t;
  };

  const gridX = div => range(0, 1, 1 / div).map(x);

  const gridY = div => range(0, 1, 1 / div).map(y);

  const sx = x(0);
  const sy = y(0);
  const ex = x(1);
  const ey = y(1);

  const xhalf = gridX(2);
  const yhalf = gridY(2);
  const xtenth = gridX(10);
  const ytenth = gridY(10);

  const gridbg = `M${sx},${sy} L${sx},${ey} L${ex},${ey} L${ex},${sy} Z`;

  const tenth = xtenth
    .map(xp => `M${xp},${sy} L${xp},${ey}`)
    .concat(ytenth.map(yp => `M${sx},${yp} L${ex},${yp}`))
    .join(' ');

  const half = xhalf
    .map(xp => `M${xp},${sy} L${xp},${ey}`)
    .concat(yhalf.map(yp => `M${sx},${yp} L${ex},${yp}`))
    .concat([`M${sx},${sy} L${ex},${ey}`])
    .join(' ');

  const ticksLeft = ytenth
    .map((yp, i) => {
      const w = 3 + (i % 5 === 0 ? 2 : 0);
      return `M${sx},${yp} L${sx - w},${yp}`;
    })
    .join(' ');

  const ticksBottom = xtenth
    .map((xp, i) => {
      const h = 3 + (i % 5 === 0 ? 2 : 0);
      return `M${xp},${sy} L${xp},${sy + h}`;
    })
    .join(' ');

  return (
    <g>
      <path className="fill-white" d={gridbg} />
      <path className="stroke-gray-300" strokeWidth="1px" d={tenth} />
      <path className="stroke-gray-300" strokeWidth="2px" d={half} />
      <path className="" strokeWidth="1px" d={ticksLeft} />
      <text className="rotate-[-90deg] text-xs" style={{ textAnchor: 'end' }} x={-y(1)} y={x(0) - 8}>
        Progress
      </text>
      <path className="" strokeWidth="1px" d={ticksBottom} />
      <text
        className="text-xs"
        style={{ textAnchor: 'end', dominantBaseline: 'text-before-edge' }}
        x={x(1)}
        y={y(0) + 5}
      >
        Time
      </text>
    </g>
  );
};

export default Grid;
