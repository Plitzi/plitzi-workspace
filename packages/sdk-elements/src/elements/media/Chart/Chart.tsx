import clsx from 'clsx';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { usePlitzi } from '@plitzi/sdk-shared/hooks';
import { useElementSize } from '@plitzi/sdk-shared/style/react';

import {
  MAX_SERIES,
  along,
  axisLabelIndexes,
  chartRows,
  chartScale,
  chartSegments,
  chartSeriesOf,
  chartSlices,
  chartTable,
  colorSlots,
  lineSummary
} from './chartGeometry';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { ChartRow, ChartTable } from './chartGeometry';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';

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
  /**
   * What the readout calls a row, when the axis says less: every minute in the readout, only `15:00` on the axis (a
   * row whose `labelField` is empty is not written there). Its `labelField` by default.
   */
  titleField?: string;
  /**
   * Charts that share a name point together: pointing at one shows the same row — by its title — on every chart of
   * that name on the page, as a monitoring screen's charts of the same minutes do.
   */
  sync?: string;
  /**
   * Several values a row, each drawn as its own line, area or bar in a colour of its own, with a legend: `[{ field,
   * label }]` (or written `field:label, field:label`), read from each record instead of `valueField`. Up to eight; a
   * row without a series's value is a gap.
   * The colours are `--plitzi-chart-series-1` to `-8`, each with a step for light and one for dark by default.
   */
  series?: unknown;
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

const MARGIN = { top: 12, right: 12, bottom: 24, left: 44 };

/** The widest a bar is drawn, whatever room its row has: past it, the room is air. */
const BAR_MAX = 24;

/**
 * The series' colours, light and dark steps of eight hues in a fixed order — checked as a set for colour-blind
 * separation and contrast on both surfaces — each a variable a space may set (`--plitzi-chart-series-1`). The page's
 * `color-scheme`, which the SDK keeps on the theme's class, picks the step.
 */
const SERIES_COLORS: readonly (readonly [string, string])[] = [
  ['#2a78d6', '#3987e5'],
  ['#eb6834', '#d95926'],
  ['#1baf7a', '#199e70'],
  ['#eda100', '#c98500'],
  ['#e87ba4', '#d55181'],
  ['#008300', '#008300'],
  ['#6250d6', '#9085e9'],
  ['#e34948', '#e66767']
];

const seriesColor = (index: number): string => {
  const [light, dark] = SERIES_COLORS[index % SERIES_COLORS.length] ?? ['currentColor', 'currentColor'];

  return `var(--plitzi-chart-series-${String(index + 1)}, light-dark(${light}, ${dark}))`;
};

const isRecordItem = (value: unknown): boolean => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The charts of each `sync` name on the page, each told the row its fellows point at — by title — or none. */
const syncGroups = new Map<string, Map<string, (title: string | undefined) => void>>();

const listen = (name: string, id: string, hear: (title: string | undefined) => void): (() => void) => {
  const group = syncGroups.get(name) ?? new Map<string, (title: string | undefined) => void>();
  group.set(id, hear);
  syncGroups.set(name, group);

  return () => {
    group.delete(id);
    if (group.size === 0) {
      syncGroups.delete(name);
    }
  };
};

const tell = (name: string, title: string | undefined, from: string) => {
  syncGroups.get(name)?.forEach((hear, id) => {
    if (id !== from) {
      hear(title);
    }
  });
};

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
  titleField: titleAsked,
  sync,
  series,
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
  const [hovered, setHovered] = useState<number | undefined>(undefined);
  /**
   * The series hidden from the legend, by key: not drawn, not in the readout, not in the scale. By key, not by place, so
   * a series hidden stays hidden when the data comes again in another order.
   */
  const [hidden, setHidden] = useState<readonly string[]>([]);
  /** Each series's colour, by key (`colorSlots`): kept through every refresh while it is drawn. */
  const [slots, setSlots] = useState<ReadonlyMap<string, number>>(() => new Map());
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  // Left empty, as the builder writes it, a row is named by its label.
  const titleField = titleAsked || labelField;
  const width = Math.max(120, Math.round(size?.width ?? DRAWN_WIDTH));
  const asked = useMemo(() => chartSeriesOf(series), [series]);
  const several = asked.length > 0 && kind !== 'donut';
  const bound = useMemo(() => chartRows(items, labelField, valueField), [items, labelField, valueField]);
  // On the builder's canvas a chart bound to nothing shows its shape, so it can be styled before its data exists.
  const rows = bound.length === 0 && !previewMode ? SAMPLE : bound;
  const table = useMemo<ChartTable>(() => {
    if (several) {
      return chartTable(items, labelField, asked, titleField);
    }

    // Records keep their places — a row with no value is a gap, as a series's is; plain numbers are read as before.
    if (bound.length > 0 && Array.isArray(items) && items.some(isRecordItem)) {
      return chartTable(items, labelField, [{ field: valueField, label: label || valueField }], titleField);
    }

    const labels = rows.map(row => row.label);

    return {
      labels,
      titles: labels,
      lines: [{ key: valueField, label: label || valueField, values: rows.map(row => row.value) }]
    };
  }, [several, items, labelField, asked, titleField, bound, rows, label, valueField]);
  const count = table.labels.length;
  const hasValues = table.lines.some(line => line.values.some(value => value !== undefined));
  const write = useMemo(() => formatter(format), [format]);
  const part = (name: string): string | undefined => (styleSelectors as Record<string, string | undefined>)[name];
  const keys = table.lines.map(line => line.key);
  const assigned = colorSlots(slots, keys);
  // Derived from the series of this render, kept for the next: React's way to remember what an earlier render saw.
  if (assigned !== slots) {
    setSlots(assigned);
  }

  const keyAt = (lineIndex: number): string => keys[lineIndex] ?? String(lineIndex);
  const colorOf = (lineIndex: number): string | undefined =>
    several ? seriesColor(assigned.get(keyAt(lineIndex)) ?? lineIndex) : undefined;

  const shows = (lineIndex: number): boolean => !hidden.includes(keyAt(lineIndex));
  /**
   * A legend's click: that series hidden or shown, the rest as they are — several hidden or shown one after another.
   * With ⌘ or Ctrl, that one alone, and every one again when it already was.
   */
  const choose = (lineIndex: number, alone: boolean) => {
    const key = keyAt(lineIndex);
    if (!alone) {
      setHidden(shows(lineIndex) ? [...hidden, key] : hidden.filter(each => each !== key));

      return;
    }

    const others = keys.filter(each => each !== key);
    const already = shows(lineIndex) && others.every(each => hidden.includes(each));
    setHidden(already ? [] : others);
  };

  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const top = MARGIN.top;
  const bottom = height - MARGIN.bottom;
  const slot = (right - left) / Math.max(1, count);
  const x = (index: number): number => left + slot * index + slot / 2;

  /** The row pointed at here, and told to the charts of its name: they show the row with the same title. */
  const point = (index: number | undefined) => {
    setHovered(index);
    if (sync) {
      tell(sync, index === undefined ? undefined : table.titles[index], uid);
    }
  };

  const titles = table.titles;
  useEffect(
    () =>
      sync
        ? listen(sync, uid, title => {
            const index = title === undefined ? -1 : titles.indexOf(title);
            setHovered(index < 0 ? undefined : index);
          })
        : undefined,
    [sync, uid, titles]
  );

  /** The row under the pointer, along the axis alone: a reader aims at a minute, never at a 2px line. */
  const pointAt = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) {
      return;
    }

    const at = (event.clientX - bounds.left) * (width / bounds.width);
    point(Math.min(count - 1, Math.max(0, Math.floor((at - left) / slot))));
  };

  const keyed = (event: KeyboardEvent<HTMLElement>) => {
    const moves: Record<string, number | undefined> = {
      ArrowLeft: Math.max(0, (hovered ?? count) - 1),
      ArrowRight: Math.min(count - 1, (hovered ?? -1) + 1),
      Home: 0,
      End: count - 1,
      Escape: undefined
    };
    if (event.key in moves) {
      event.preventDefault();
      point(moves[event.key]);
    }
  };

  const drawing = (() => {
    if (count === 0 || !hasValues) {
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

    const scale = chartScale(
      table.lines.flatMap((line, lineIndex) =>
        shows(lineIndex) ? line.values.filter((value): value is number => value !== undefined) : []
      ),
      max
    );
    const y = (value: number): number => along(value, scale, bottom, top);
    const zero = y(Math.max(scale.min, 0));
    // The series drawn, in order: a row's bars are theirs alone, side by side with no gap for a hidden one.
    const drawn = table.lines.flatMap((_line, lineIndex) => (shows(lineIndex) ? [lineIndex] : []));
    const lines = Math.max(1, drawn.length);
    // A row's bars side by side, each as wide as the room allows up to its cap, the group centred on the row.
    const barWidth = Math.max(1, Math.min(BAR_MAX, (slot * 0.7) / lines - (lines > 1 ? 1 : 0)));
    const groupWidth = barWidth * lines + (lines > 1 ? lines - 1 : 0);
    const barX = (index: number, line: number): number => x(index) - groupWidth / 2 + line * (barWidth + 1);

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        style={FIT}
        aria-hidden="true"
      >
        {several && kind === 'area' && (
          <defs>
            {table.lines.map((line, lineIndex) => (
              // Each series's fill fades towards the axis: the lines read, the fills do not pile up into a block.
              <linearGradient
                key={`fade-${line.label}-${String(lineIndex)}`}
                id={`${uid}-fade-${String(lineIndex)}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" style={{ stopColor: seriesColor(lineIndex), stopOpacity: 0.32 }} />
                <stop offset="1" style={{ stopColor: seriesColor(lineIndex), stopOpacity: 0.02 }} />
              </linearGradient>
            ))}
          </defs>
        )}
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
        {axisLabelIndexes(table.labels, slot).map(index => (
          <g key={`label-${String(index)}`}>
            {/* A line where the axis names a row, as a monitoring chart marks its round times. */}
            {kind !== 'bar' && (
              <line className={clsx('chart__grid', part('grid'))} x1={x(index)} x2={x(index)} y1={top} y2={bottom} />
            )}
            <text className={clsx('chart__axis', part('axisLabel'))} x={x(index)} y={bottom + 16} textAnchor="middle">
              {table.labels[index]}
            </text>
          </g>
        ))}
        {table.lines.map((line, lineIndex) => {
          if (!shows(lineIndex)) {
            return null;
          }

          const color = colorOf(lineIndex);
          const segments = chartSegments(line.values);
          const path = (segment: { index: number; value: number }[]) =>
            segment
              .map((point, at) => `${at === 0 ? 'M' : 'L'} ${String(x(point.index))} ${String(y(point.value))}`)
              .join(' ');

          return (
            <g key={`series-${line.key}`} data-series={lineIndex}>
              {kind === 'bar' &&
                line.values.map((value, index) =>
                  value === undefined ? null : (
                    <rect
                      key={`bar-${String(index)}`}
                      className={clsx('chart__bar', part('bar'))}
                      style={color ? { fill: color } : undefined}
                      x={barX(index, drawn.indexOf(lineIndex))}
                      width={barWidth}
                      y={Math.min(y(value), zero)}
                      height={Math.abs(zero - y(value))}
                    />
                  )
                )}
              {kind === 'area' &&
                segments.map(segment => (
                  <path
                    key={`area-${String(segment[0]?.index ?? 0)}`}
                    className={clsx('chart__area', part('area'))}
                    style={color ? { fill: `url(#${uid}-fade-${String(lineIndex)})`, fillOpacity: 1 } : undefined}
                    d={`${path(segment)} L ${String(x(segment.at(-1)?.index ?? 0))} ${String(zero)} L ${String(x(segment[0]?.index ?? 0))} ${String(zero)} Z`}
                  />
                ))}
              {(kind === 'line' || kind === 'area') &&
                segments.map(segment => (
                  <path
                    key={`line-${String(segment[0]?.index ?? 0)}`}
                    className={clsx('chart__line', part('line'))}
                    style={color ? { stroke: color, strokeWidth: '2px' } : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    d={path(segment)}
                  />
                ))}
              {/* One series draws its points; several draw a lone value's alone, so a one-minute blip still shows. */}
              {(kind === 'line' || kind === 'area') &&
                (several ? segments.filter(segment => segment.length === 1).flat() : segments.flat()).map(point => (
                  <circle
                    key={`point-${String(point.index)}`}
                    className={clsx('chart__point', part('point'))}
                    style={color ? { fill: color } : undefined}
                    cx={x(point.index)}
                    cy={y(point.value)}
                    r={several ? 2.5 : 3.5}
                  />
                ))}
              {showValues &&
                line.values.map((value, index) =>
                  value === undefined ? null : (
                    <text
                      key={`value-${String(index)}`}
                      className={clsx('chart__value', part('valueLabel'))}
                      x={kind === 'bar' ? barX(index, drawn.indexOf(lineIndex)) + barWidth / 2 : x(index)}
                      y={Math.min(y(value), zero) - 6}
                      textAnchor="middle"
                    >
                      {write(value)}
                    </text>
                  )
                )}
            </g>
          );
        })}
        {hovered !== undefined && (
          <g className="chart__crosshair" pointerEvents="none">
            <line
              x1={x(hovered)}
              x2={x(hovered)}
              y1={top}
              y2={bottom}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            {kind !== 'bar' &&
              table.lines.map((line, lineIndex) => {
                const value = line.values[hovered];

                return value === undefined || !shows(lineIndex) ? null : (
                  <circle
                    key={`hover-${String(lineIndex)}`}
                    cx={x(hovered)}
                    cy={y(value)}
                    r={4}
                    style={{ fill: colorOf(lineIndex) ?? 'currentColor', stroke: 'Canvas', strokeWidth: 2 }}
                  />
                );
              })}
          </g>
        )}
        <rect
          className="chart__hit"
          x={left}
          y={top}
          width={Math.max(0, right - left)}
          height={Math.max(0, bottom - top)}
          fill="transparent"
          onPointerMove={pointAt}
          onPointerDown={pointAt}
          onPointerLeave={() => point(undefined)}
        />
      </svg>
    );
  })();

  const tooltip =
    drawing && kind !== 'donut' && hovered !== undefined ? (
      <div
        className={clsx('chart__tooltip', part('tooltip'))}
        style={{
          ...TOOLTIP,
          left: `${String((x(hovered) / width) * 100)}%`,
          // Beside the crosshair, on whichever side has the room.
          transform: x(hovered) / width > 0.6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)'
        }}
      >
        <div className="chart__tooltip-title" style={MUTED}>
          {table.titles[hovered]}
        </div>
        {table.lines.map((line, lineIndex) => {
          const value = line.values[hovered];

          return !shows(lineIndex) ? null : (
            <div key={`tip-${line.label}-${String(lineIndex)}`} className="chart__tooltip-row" style={TIP_ROW}>
              <span aria-hidden="true" style={{ ...LINE_KEY, background: colorOf(lineIndex) ?? 'currentColor' }} />
              <strong>{value === undefined ? '—' : write(value)}</strong>
              <span style={MUTED}>{line.label}</span>
            </div>
          );
        })}
      </div>
    ) : null;

  const notDrawn = asked.length > MAX_SERIES ? asked.length - MAX_SERIES : 0;

  return (
    <RootElement
      ref={ref}
      tag="figure"
      className={clsx('plitzi-component__chart', `chart--${kind}`, className)}
      role="figure"
      aria-label={label || undefined}
      // The readout moves by the keyboard too: the same values a pointer reads, row by row.
      {...(drawing && kind !== 'donut' ? { tabIndex: 0, onKeyDown: keyed, onBlur: () => point(undefined) } : {})}
    >
      <div ref={box} className="chart__canvas" style={CANVAS}>
        {drawing ?? <p className={clsx('chart__empty', part('empty'))}>{emptyText}</p>}
        {tooltip}
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
      {/* Several series are told apart by a legend, never by colour alone: each named, with its last value and its highest. */}
      {several && drawing && (
        <ul className={clsx('chart__legend', part('legend'))}>
          {table.lines.map((line, lineIndex) => {
            const { last, max: highest } = lineSummary(line.values);

            return (
              <li key={`legend-${line.key}`} data-series={lineIndex}>
                <button
                  type="button"
                  className="chart__legend-item"
                  aria-pressed={shows(lineIndex)}
                  title="Hide or show it — ⌘ or Ctrl to show it alone, again for every one"
                  style={{ ...LEGEND_ITEM, ...(shows(lineIndex) ? {} : HIDDEN_ITEM) }}
                  onClick={event => {
                    choose(lineIndex, event.metaKey || event.ctrlKey);
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={
                      kind === 'line'
                        ? { ...LINE_KEY, background: colorOf(lineIndex) }
                        : { ...BOX_KEY, background: colorOf(lineIndex) }
                    }
                  />
                  <span>{line.label}</span>
                  {last !== undefined && (
                    <span style={MUTED}>
                      last {write(last)} · max {write(highest ?? last)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {notDrawn > 0 && <li style={MUTED}>{notDrawn} more not drawn: a chart tells eight apart</li>}
        </ul>
      )}
      {/* What the picture says, read by a screen reader — and by a page read without its script: it is in the HTML. */}
      {count > 0 && kind !== 'donut' && (
        <table className="chart__data" style={HIDDEN}>
          {label && <caption>{label}</caption>}
          {several && (
            <thead>
              <tr>
                <td />
                {table.lines.map((line, lineIndex) => (
                  <th key={`head-${line.label}-${String(lineIndex)}`} scope="col">
                    {line.label}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {table.labels.map((rowLabel, index) => (
              <tr key={`row-${rowLabel}-${String(index)}`}>
                <th scope="row">{rowLabel}</th>
                {table.lines.map((line, lineIndex) => {
                  const value = line.values[index];

                  return <td key={`cell-${String(lineIndex)}`}>{value === undefined ? '—' : write(value)}</td>;
                })}
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

const CANVAS = { position: 'relative' } as const;

/** The readout beside the crosshair: the page's own canvas and text, whatever the theme. */
const TOOLTIP = {
  position: 'absolute',
  top: '4px',
  zIndex: 2,
  pointerEvents: 'none',
  minWidth: '120px',
  maxWidth: '280px',
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
  background: 'Canvas',
  color: 'CanvasText',
  boxShadow: '0 4px 14px rgb(0 0 0 / 0.18)',
  fontSize: '12px',
  lineHeight: '1.45',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap'
} as const;

const TIP_ROW = { display: 'flex', alignItems: 'center', gap: '6px' } as const;

/**
 * A series's key: a short stroke of its colour for a line — its ends rounded, a pill rather than a corner of its own —
 * and a small square for a bar or an area.
 */
const LINE_KEY = {
  display: 'inline-block',
  width: '12px',
  height: '2px',
  borderRadius: '999px',
  flexShrink: 0
} as const;

const BOX_KEY = { display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', flexShrink: 0 } as const;

const LEGEND_ITEM = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: 0,
  border: 0,
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left'
} as const;

/** A series hidden from the legend: still named there, faded, to show it again. */
const HIDDEN_ITEM = { opacity: 0.4, textDecorationLine: 'line-through' } as const;

const MUTED = { opacity: 0.65 } as const;

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
