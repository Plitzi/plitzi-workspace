import { useMemo } from 'react';

import BezierEasing from './BezierEasing';

export type ProgressProps = {
  progress?: number;
  xFrom?: number;
  xTo?: number;
  yFrom?: number;
  yTo?: number;
  value: [number, number, number, number];
};

const Progress = ({ progress = 0, xFrom = 0, xTo = 0, yFrom = 0, yTo = 0, value }: ProgressProps) => {
  const easing = useMemo<((progress: number) => number) | undefined>(() => BezierEasing(...value), [value]);

  const interp = (a: number, b: number, x: number) => a * (1 - x) + b * x;

  const x = (value: number) => Math.round(interp(xFrom, xTo, value));

  const y = (value: number) => Math.round(interp(yFrom, yTo, value));

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

export default Progress;
