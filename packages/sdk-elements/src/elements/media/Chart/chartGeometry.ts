/**
 * The chart's arithmetic, apart from React: which rows it draws, the scale's round steps, where each bar, point and
 * slice falls. Pure, so the server's render and the browser's agree to the decimal — a chart drawn on the server is
 * the one the page hydrates.
 */

export type ChartRow = { label: string; value: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const numberOf = (value: unknown): number | undefined => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

  return typeof number === 'number' && Number.isFinite(number) ? number : undefined;
};

/**
 * The rows a chart draws from what it was bound to: records, read by `labelField` and `valueField` — or plain numbers,
 * labelled by their place. A row whose value is no number is left out; never drawn as zero, which is a value.
 */
export const chartRows = (items: unknown, labelField: string, valueField: string): ChartRow[] =>
  (Array.isArray(items) ? items : []).flatMap((item, index): ChartRow[] => {
    if (!isRecord(item)) {
      const value = numberOf(item);

      return value === undefined ? [] : [{ label: String(index + 1), value }];
    }

    const value = numberOf(item[valueField]);
    const label = item[labelField];

    return value === undefined
      ? []
      : [{ label: typeof label === 'string' || typeof label === 'number' ? String(label) : String(index + 1), value }];
  });

/** A round step for about `count` gridlines over `span`: 1, 2 or 5 times a power of ten. */
const niceStep = (span: number, count: number): number => {
  const raw = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;

  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
};

/**
 * The value axis: from zero (or the lowest value, when one is below it) to a round top above the highest, in round
 * steps — the gridlines a reader counts by. `max` fixes the top: a percentage out of 100.
 */
export const chartScale = (rows: readonly ChartRow[], max?: number): { min: number; max: number; ticks: number[] } => {
  const values = rows.map(row => row.value);
  const low = Math.min(0, ...values);
  const high = max ?? Math.max(0, ...values);
  if (high === low) {
    return { min: low, max: low + 1, ticks: [low, low + 1] };
  }

  const step = niceStep(high - low, 4);
  const min = Math.floor(low / step) * step;
  const top = max ?? Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let tick = min; tick <= top + step / 1000; tick += step) {
    ticks.push(Number(tick.toFixed(10)));
  }

  return { min, max: top, ticks };
};

/** Where a value falls on an axis drawn from `start` (the scale's minimum) to `end` (its maximum). */
export const along = (value: number, scale: { min: number; max: number }, start: number, end: number): number =>
  start + ((value - scale.min) / (scale.max - scale.min)) * (end - start);

/**
 * A donut's slices: each row's share of the whole, as where it starts and how long it runs around the ring (0–1).
 * Negative values have no share of a whole: left out.
 */
export const chartSlices = (rows: readonly ChartRow[]): { row: ChartRow; start: number; share: number }[] => {
  const shown = rows.filter(row => row.value > 0);
  const total = shown.reduce((sum, row) => sum + row.value, 0);
  let start = 0;

  return shown.map(row => {
    const share = total === 0 ? 0 : row.value / total;
    const slice = { row, start, share };
    start += share;

    return slice;
  });
};
