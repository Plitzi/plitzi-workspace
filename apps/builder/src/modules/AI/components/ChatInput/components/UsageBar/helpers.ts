const CX = 8;
const CY = 8;
const R = 6;
const CIRCUMFERENCE = 2 * Math.PI * R;

const polar = (deg: number) => ({
  x: CX + R * Math.cos(((deg - 90) * Math.PI) / 180),
  y: CY + R * Math.sin(((deg - 90) * Math.PI) / 180)
});

const arc = (startDeg: number, endDeg: number): string => {
  const s = polar(startDeg);
  const e = polar(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;

  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
};

const buildRanges = (n: number, gap: number): [number, number][] => {
  const span = 360 / n;

  return Array.from({ length: n }, (_, i) => [i * span + gap / 2, (i + 1) * span - gap / 2]);
};

export { buildRanges, arc, CX, CY, R, CIRCUMFERENCE };
