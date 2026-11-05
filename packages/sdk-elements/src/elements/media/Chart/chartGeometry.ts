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

/** One of several values a row carries, drawn as its own line, area or bar: the field it is read from, and its name. */
export type ChartSeries = { field: string; label: string };

/**
 * The series a chart was given — bound, so anything, or written as `field:label, field:label` — as the ones it can
 * draw: each a field and a name. One that is not is left out; a name left empty is its field.
 */
export const chartSeriesOf = (value: unknown): ChartSeries[] =>
  // As the builder's settings write them, `cpu:CPU, memory:Memory`; as a binding hands them, records.
  (typeof value === 'string'
    ? value.split(',').map(each => {
        const [field = '', label = ''] = each.split(':').map(part => part.trim());

        return { field, label };
      })
    : Array.isArray(value)
      ? value
      : []
  ).flatMap((each): ChartSeries[] =>
    isRecord(each) && typeof each.field === 'string' && each.field !== ''
      ? [{ field: each.field, label: typeof each.label === 'string' && each.label !== '' ? each.label : each.field }]
      : []
  );

/** Each series's values in the rows' order: a row without one is a gap in that series, never a zero. */
export type ChartLine = { label: string; values: (number | undefined)[] };

/** The rows' axis labels, what the readout calls each (`titles`), and each series's values. */
export type ChartTable = { labels: string[]; titles: string[]; lines: ChartLine[] };

/**
 * The most series one chart tells apart by colour: past eight, hues stop being told apart reliably, so a ninth is not
 * drawn in a colour of its own — it is left out, and the legend says how many were.
 */
export const MAX_SERIES = 8;

/**
 * The rows a chart of several series draws: every record keeps its place, so the axis is the rows' — a minute with no
 * value for one series is a gap in its line, not a point moved along — each series read by its own field.
 */
export const chartTable = (
  items: unknown,
  labelField: string,
  series: readonly ChartSeries[],
  titleField = labelField
): ChartTable => {
  const records = (Array.isArray(items) ? items : []).filter(isRecord);
  const words = (field: string) =>
    records.map((record, index) => {
      const label = record[field];

      return typeof label === 'string' || typeof label === 'number' ? String(label) : String(index + 1);
    });
  const labels = words(labelField);

  return {
    labels,
    titles: titleField === labelField ? labels : words(titleField),
    lines: series
      .slice(0, MAX_SERIES)
      .map(each => ({ label: each.label, values: records.map(record => numberOf(record[each.field])) }))
  };
};

/** One series's runs of consecutive values, each as the places and values it joins: a line breaks where one is missing. */
export const chartSegments = (values: readonly (number | undefined)[]): { index: number; value: number }[][] =>
  values.reduce<{ index: number; value: number }[][]>((segments, value, index) => {
    if (value === undefined) {
      return segments;
    }

    const last = segments.at(-1);
    const previous = last?.at(-1);
    if (last && previous && previous.index === index - 1) {
      last.push({ index, value });
    } else {
      segments.push([{ index, value }]);
    }

    return segments;
  }, []);

/**
 * Which labels of the axis are written, so none runs into the next: each one at least `minGap` pixels after the last
 * written, where each row has `slot`. A label left empty is not written — an axis of minutes that names only its
 * round times writes all of them that fit.
 */
export const axisLabelIndexes = (labels: readonly string[], slot: number, minGap = 56): number[] => {
  let last = Number.NEGATIVE_INFINITY;

  return labels.flatMap((label, index) => {
    if (label === '' || (index - last) * slot < minGap) {
      return [];
    }

    last = index;

    return [index];
  });
};

/** The last value a series has, and its highest: what the legend says beside its name. */
export const lineSummary = (values: readonly (number | undefined)[]): { last?: number; max?: number } => {
  const defined = values.filter((value): value is number => value !== undefined);

  return defined.length === 0 ? {} : { last: defined.at(-1), max: Math.max(...defined) };
};

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
export const chartScale = (values: readonly number[], max?: number): { min: number; max: number; ticks: number[] } => {
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
