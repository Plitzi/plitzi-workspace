import clsx from 'clsx';
import { useMemo, useRef } from 'react';

import { usePlitzi } from '@plitzi/sdk-shared/hooks';
import { useElementSize } from '@plitzi/sdk-shared/style/react';

import { along, chartRows, chartScale, chartSlices } from './chartGeometry';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { ChartRow } from './chartGeometry';
import type { RefObject } from 'react';

export type ChartProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  /** Bars, a line, a filled line, or a donut of each row's share. */
  kind?: 'bar' | 'line' | 'area' | 'donut';
  /**
   * The rows it draws — bound, as a list's are: `bindTemplate('items', 'stats.data', '{{ source.days }}', { returns:
   * 'value' })`. Records, read by `labelField` and `valueField`, or plain numbers.
   */
  items?: unknown;
  labelField?: string;
  valueField?: string;
  /** What the chart shows, in words: its accessible name — a chart a screen reader cannot name is nothing to it. */
  label?: string;
  /** The value axis's top, when it is not the data's: 100 for a percentage. */
  max?: number;
  /** How its values are written: `1,284`, `42%`, `1.3K`. */
  format?: 'number' | 'percent' | 'compact';
  /** Each value written at its bar, point or slice. */
  showValues?: boolean;
  /** Its height in pixels; it takes its box's width. A donut is as wide as it is tall. */
  height?: number;
  /** What it says when it has no rows to draw. */
  emptyText?: string;
};

/** The width it is drawn at before its box is measured: the server's render, and the browser's first. */
const DRAWN_WIDTH = 600;

/** What the builder's canvas draws for a chart bound to nothing yet: a shape to style, not data. */
const SAMPLE: ChartRow[] = [
  { label: 'Mon', value: 4 },
  { label: 'Tue', value: 7 },
  { label: 'Wed', value: 5 },
  { label: 'Thu', value: 9 },
  { label: 'Fri', value: 6 }
];

const MARGIN = { top: 16, right: 12, bottom: 28, left: 44 };

const formatter = (format: NonNullable<ChartProps['format']>): ((value: number) => string) => {
  if (format === 'percent') {
    const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

    return value => `${number.format(value)}%`;
  }

  const number = new Intl.NumberFormat('en', format === 'compact' ? { notation: 'compact' } : {});

  return value => number.format(value);
};

/** A point on the ring of a donut, from the top, clockwise: where a slice starts or ends. */
const onRing = (share: number, radius: number, centre: number): string => {
  const angle = share * 2 * Math.PI - Math.PI / 2;

  return `${String(centre + radius * Math.cos(angle))} ${String(centre + radius * Math.sin(angle))}`;
};

const Chart = ({
  ref,
  className = '',
  kind = 'bar',
  items,
  labelField = 'label',
  valueField = 'value',
  label = '',
  max,
  format = 'number',
  showValues = false,
  height = 240,
  emptyText = 'No data yet'
}: ChartProps) => {
  const {
    definition: { styleSelectors }
  } = useElement();
  const {
    settings: { previewMode }
  } = usePlitzi();
  const box = useRef<HTMLDivElement>(null);
  const size = useElementSize(box);
  const width = Math.max(120, Math.round(size?.width ?? DRAWN_WIDTH));
  const bound = useMemo(() => chartRows(items, labelField, valueField), [items, labelField, valueField]);
  // On the builder's canvas a chart bound to nothing shows its shape, so it can be styled before its data exists.
  const rows = bound.length === 0 && !previewMode ? SAMPLE : bound;
  const write = useMemo(() => formatter(format), [format]);
  const part = (name: string): string | undefined => (styleSelectors as Record<string, string | undefined>)[name];

  const drawing = (() => {
    if (rows.length === 0) {
      return null;
    }

    if (kind === 'donut') {
      const side = Math.min(width, height);
      const centre = side / 2;
      const radius = side / 2 - 8;

      return (
        <svg width={side} height={side} viewBox={`0 0 ${String(side)} ${String(side)}`} style={FIT} aria-hidden="true">
          {chartSlices(rows).map(({ row, start, share }, index) => (
            <path
              key={`${row.label}-${String(index)}`}
              className={clsx('chart__slice', part('slice'))}
              data-index={index}
              // Each slice a step lighter of the chart's colour: themed by one colour, told apart by its lightness.
              fillOpacity={Math.max(0.25, 1 - index * 0.15)}
              d={
                share >= 0.9999
                  ? `M ${onRing(0, radius, centre)} A ${String(radius)} ${String(radius)} 0 1 1 ${onRing(0.4999, radius, centre)} A ${String(radius)} ${String(radius)} 0 1 1 ${onRing(0, radius, centre)} Z`
                  : `M ${String(centre)} ${String(centre)} L ${onRing(start, radius, centre)} A ${String(radius)} ${String(radius)} 0 ${share > 0.5 ? 1 : 0} 1 ${onRing(start + share, radius, centre)} Z`
              }
            />
          ))}
          <circle className={clsx('chart__hole', part('hole'))} cx={centre} cy={centre} r={radius * 0.6} />
        </svg>
      );
    }

    const scale = chartScale(rows, max);
    const left = MARGIN.left;
    const right = width - MARGIN.right;
    const top = MARGIN.top;
    const bottom = height - MARGIN.bottom;
    const slot = (right - left) / rows.length;
    const y = (value: number): number => along(value, scale, bottom, top);
    const x = (index: number): number => left + slot * index + slot / 2;
    const zero = y(Math.max(scale.min, 0));
    const points = rows.map((row, index) => `${String(x(index))},${String(y(row.value))}`).join(' ');

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        style={FIT}
        aria-hidden="true"
      >
        {scale.ticks.map(tick => (
          <g key={tick}>
            <line className={clsx('chart__grid', part('grid'))} x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
            <text
              className={clsx('chart__axis', part('axisLabel'))}
              x={left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {write(tick)}
            </text>
          </g>
        ))}
        {rows.map((row, index) => (
          <text
            key={`label-${row.label}-${String(index)}`}
            className={clsx('chart__axis', part('axisLabel'))}
            x={x(index)}
            y={bottom + 18}
            textAnchor="middle"
          >
            {row.label}
          </text>
        ))}
        {kind === 'bar' &&
          rows.map((row, index) => (
            <rect
              key={`bar-${row.label}-${String(index)}`}
              className={clsx('chart__bar', part('bar'))}
              x={x(index) - (slot * 0.6) / 2}
              width={slot * 0.6}
              y={Math.min(y(row.value), zero)}
              height={Math.abs(zero - y(row.value))}
            />
          ))}
        {kind === 'area' && (
          <polygon
            className={clsx('chart__area', part('area'))}
            points={`${String(x(0))},${String(zero)} ${points} ${String(x(rows.length - 1))},${String(zero)}`}
          />
        )}
        {(kind === 'line' || kind === 'area') && (
          <>
            <polyline className={clsx('chart__line', part('line'))} points={points} />
            {rows.map((row, index) => (
              <circle
                key={`point-${row.label}-${String(index)}`}
                className={clsx('chart__point', part('point'))}
                cx={x(index)}
                cy={y(row.value)}
                r={3.5}
              />
            ))}
          </>
        )}
        {showValues &&
          rows.map((row, index) => (
            <text
              key={`value-${row.label}-${String(index)}`}
              className={clsx('chart__value', part('valueLabel'))}
              x={x(index)}
              y={Math.min(y(row.value), zero) - 6}
              textAnchor="middle"
            >
              {write(row.value)}
            </text>
          ))}
      </svg>
    );
  })();

  return (
    <RootElement
      ref={ref}
      tag="figure"
      className={clsx('plitzi-component__chart', `chart--${kind}`, className)}
      role="figure"
      aria-label={label || undefined}
    >
      <div ref={box} className="chart__canvas">
        {drawing ?? <p className={clsx('chart__empty', part('empty'))}>{emptyText}</p>}
      </div>
      {kind === 'donut' && rows.length > 0 && (
        <ul className={clsx('chart__legend', part('legend'))}>
          {chartSlices(rows).map(({ row, share }, index) => (
            <li key={`legend-${row.label}-${String(index)}`} data-index={index}>
              <span aria-hidden="true" style={{ opacity: Math.max(0.25, 1 - index * 0.15) }}>
                ●
              </span>{' '}
              {row.label} · {write(row.value)} ({Math.round(share * 100)}%)
            </li>
          ))}
        </ul>
      )}
      {/* What the picture says, read by a screen reader — and by a page read without its script: it is in the HTML. */}
      {rows.length > 0 && kind !== 'donut' && (
        <table className="chart__data" style={HIDDEN}>
          {label && <caption>{label}</caption>}
          <tbody>
            {rows.map((row, index) => (
              <tr key={`row-${row.label}-${String(index)}`}>
                <th scope="row">{row.label}</th>
                <td>{write(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </RootElement>
  );
};

/** Never wider than its box: drawn at a guessed width until the box is measured, it shrinks rather than overflows. */
const FIT = { maxWidth: '100%', height: 'auto', display: 'block' } as const;

/** Off the screen and still read: the data table beside the drawing. */
const HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0
} as const;

export default withElement(Chart);

export { Chart };
