const valueDefault: number[] = [];

export type CurveProps = {
  value?: number[];
  xFrom?: number;
  xTo?: number;
  yFrom?: number;
  yTo?: number;
};

const Curve = ({ value = valueDefault, xFrom = 0, xTo = 0, yFrom = 0, yTo = 0 }: CurveProps) => {
  const interp = (a: number, b: number, x: number) => a * (1 - x) + b * x;

  const x = (value: number) => Math.round(interp(xFrom, xTo, value));

  const y = (value: number) => Math.round(interp(yFrom, yTo, value));

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
