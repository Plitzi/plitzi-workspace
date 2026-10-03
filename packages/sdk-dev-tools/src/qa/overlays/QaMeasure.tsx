import { distancesBetween } from '../inspect/measure';

export type QaMeasureProps = { from: Element; to: Element };

/** The distances between two elements, drawn and labelled — what a designer measures spacing with. */
const QaMeasure = ({ from, to }: QaMeasureProps) => {
  const distances = distancesBetween(from.getBoundingClientRect(), to.getBoundingClientRect());

  return (
    <svg className="pointer-events-none fixed inset-0 z-[999998] h-full w-full overflow-visible" aria-hidden="true">
      {distances.map(({ x1, y1, x2, y2, length }) => (
        <g key={`${String(x1)}-${String(y1)}-${String(x2)}-${String(y2)}`}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f43f5e" strokeWidth={1} />
          <rect x={(x1 + x2) / 2 - 16} y={(y1 + y2) / 2 - 9} width={32} height={18} rx={4} fill="#f43f5e" />
          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 + 4}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={11}
            fontFamily="ui-monospace, monospace"
          >
            {length}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default QaMeasure;
