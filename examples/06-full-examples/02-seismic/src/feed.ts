import { passes, perFilter } from './filters.ts';

import type { DepthKey, FloorKey } from './filters.ts';

/**
 * The USGS feed, and the shape a page can actually draw.
 *
 * GeoJSON is a transport format: a `features` array of coordinate triples and a properties bag of twenty-odd fields,
 * most of them about how the measurement was made. A monitor needs a dozen, in the units it shows them in, plus the
 * totals it leads with. Reshaping that is real work, so it is a TASK — a twig expression pretending to flatten
 * GeoJSON would be a worse example than the honest version.
 *
 * Everything here runs on the SERVER. The browser never talks to the USGS: the page is built with the answer already
 * in it, and every refresh asks this same server again.
 */

/**
 * No key, no quota, regenerated every minute.
 *
 * Every window carries every magnitude except the month, where the USGS publishes nothing below M2.5 — all of a month
 * is tens of thousands of events. The magnitude filter is the page's, not the feed's, so the page says when the feed
 * has already applied a floor of its own.
 */
const FEEDS = {
  hour: { url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson', floorNote: '' },
  day: { url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', floorNote: '' },
  week: { url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson', floorNote: '' },
  month: {
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson',
    floorNote: 'The 30-day feed starts at M2.5'
  }
} as const;

export type FeedWindow = keyof typeof FEEDS;

export const isFeedWindow = (value: unknown): value is FeedWindow => typeof value === 'string' && value in FEEDS;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How each window is read: its length, and how the activity strip cuts it.
 *
 * The strip is a histogram, so its bins are chosen for the reader rather than for arithmetic — five minutes across an
 * hour, an hour across a day, six hours across a week, a day across a month. Each ends NOW, which is the edge a live
 * display is read from.
 */
const SPANS: Record<FeedWindow, { span: number; bin: number; label: string; binLabel: string; axisStart: string }> = {
  hour: { span: HOUR, bin: 5 * MINUTE, label: '1 H', binLabel: '5 MIN BINS', axisStart: '−60 MIN' },
  day: { span: DAY, bin: HOUR, label: '24 H', binLabel: '1 H BINS', axisStart: '−24 H' },
  week: { span: 7 * DAY, bin: 6 * HOUR, label: '7 D', binLabel: '6 H BINS', axisStart: '−7 D' },
  month: { span: 30 * DAY, bin: DAY, label: '30 D', binLabel: '1 DAY BINS', axisStart: '−30 D' }
};

/**
 * Focal depth, in the bands a seismologist reads it in.
 *
 * Depth is what decides whether an earthquake is felt: a M6 at 15 km flattens a town, the same magnitude at 500 km
 * is an instrument reading. The map colours by it and the legend explains it, so the band is decided once, here.
 */
export type DepthBand = 'shallow' | 'intermediate' | 'deep';

const bandOf = (depthKm: number): DepthBand => {
  if (depthKm < 70) {
    return 'shallow';
  }

  return depthKm < 300 ? 'intermediate' : 'deep';
};

/** One event, in the units the map and the readouts use. Nothing else from the feed survives. */
export type Quake = {
  id: string;
  /** The USGS one-line description, e.g. "18 km SSE of Volcano, Hawaii". */
  place: string;
  /** Just the region half of it, for a column that has no room for the distance. */
  region: string;
  magnitude: number;
  /** `M4.0`, not `M4`: two numbers that are the same magnitude, and only one of them is how it is written. */
  magnitudeLabel: string;
  /** How it was measured — `mww`, `ml`, `md`… A moment magnitude and a local one are not the same instrument. */
  magnitudeType: string;
  depthKm: number;
  depthLabel: string;
  band: DepthBand;
  latitude: number;
  longitude: number;
  /** `38.21°N 142.37°E` — hemispheres, never signs, which is how a position is read aloud. */
  coordinates: string;
  /** Milliseconds since the epoch. The page formats it, in UTC, and says so. */
  time: number;
  /** "4m", "2h", "3d" before the feed was generated — the same for every visitor between two refreshes. */
  ageLabel: string;
  /** Inside the last hour of the feed: the map rings it and the log marks it. */
  isFresh: boolean;
  /** USGS significance, 0–1000: magnitude, felt reports and estimated impact in one number. */
  significance: number;
  /** As a share of the scale, for the bar that draws it. */
  significancePct: number;
  tsunami: boolean;
  /** The PAGER alert for estimated losses — `green` to `red` — or `none` when none was issued. */
  alert: 'none' | 'green' | 'yellow' | 'orange' | 'red';
  /** "Did You Feel It?" reports. Zero is a real answer for an event in the middle of an ocean. */
  felt: number;
  /** Peak shaking on the Modified Mercalli scale, in its own roman numerals — or "—" when it was not estimated. */
  intensity: string;
  /** `reviewed` by a seismologist, or still `automatic`. An automatic magnitude can move. */
  status: string;
  network: string;
  url: string;
};

/** One value per magnitude floor and depth band: `grid[computed.floor][computed.depth]`. */
export type ByFilter<T> = Record<FloorKey, Record<DepthKey, T>>;

export type ActivityBin = {
  id: string;
  /**
   * The bar's height under every filter — relative to the busiest bin under the SAME filter, so a strip filtered to
   * M5+ still uses its whole height instead of a sliver at the foot of the unfiltered one.
   */
  pct: ByFilter<number>;
};

/** The window's totals, under one filter. */
export type WindowStats = {
  count: number;
  m6: number;
  tsunami: number;
  /** PAGER alerts above green: events expected to cause damage or casualties somewhere. */
  alerts: number;
  /** Radiated energy, as a TNT equivalent — the one total of a magnitude scale that means something physical. */
  energy: string;
  energyUnit: string;
};

export type SeismicReport = {
  window: FeedWindow;
  windowLabel: string;
  /** A qualification the page must show beside the window, or nothing. */
  floorNote: string;
  /** Every event in the window, newest first. The map draws all of them; the page filters and crops. */
  records: Quake[];
  isEmpty: boolean;
  /**
   * The totals under every filter the page offers, so a counter picks a number rather than counting two thousand rows
   * in a template on every refresh.
   */
  stats: ByFilter<WindowStats>;
  bins: ActivityBin[];
  binLabel: string;
  axisStart: string;
  /** When the USGS generated the feed. It moves once a minute, whatever the page's cadence. */
  generatedAt: number;
  /**
   * When this server asked the USGS for it — what moves on every refresh. The two together say both "the page is
   * listening" and "how old the news is": a feed checked a second ago can still be a minute old.
   */
  checkedAt: number;
};

type Feature = {
  id?: string;
  properties?: {
    place?: string | null;
    mag?: number | null;
    magType?: string | null;
    time?: number | null;
    sig?: number | null;
    tsunami?: number | null;
    alert?: string | null;
    felt?: number | null;
    mmi?: number | null;
    status?: string | null;
    net?: string | null;
    url?: string | null;
  };
  geometry?: { coordinates?: (number | null)[] };
};

/**
 * The half of a place name worth showing in a narrow column.
 *
 * USGS writes "18 km SSE of Volcano, Hawaii". The distance and bearing are precision nobody reads at a glance, and they
 * push the part that identifies the event off the end of the row.
 */
const regionOf = (place: string): string => {
  const separator = place.indexOf(' of ');

  return separator === -1 ? place : place.slice(separator + 4);
};

const hemisphere = (value: number, positive: string, negative: string): string =>
  `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const intensityOf = (mmi: number | null | undefined): string =>
  typeof mmi === 'number' && mmi >= 1 ? ROMAN[Math.min(Math.round(mmi), 12) - 1] : '—';

const ALERTS: readonly string[] = ['green', 'yellow', 'orange', 'red'] satisfies Quake['alert'][];

const isAlert = (value: string | null | undefined): value is Exclude<Quake['alert'], 'none'> =>
  typeof value === 'string' && ALERTS.includes(value);

const alertOf = (alert: string | null | undefined): Quake['alert'] => (isAlert(alert) ? alert : 'none');

/** "3 min ago", in the words a monitor uses. Relative to the feed, so every visitor reads the same clock. */
const ageOf = (time: number, reference: number): string => {
  const minutes = Math.max(Math.round((reference - time) / MINUTE), 0);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.round(minutes / 60);

  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
};

const toQuake = (feature: Feature, generatedAt: number): Quake | undefined => {
  const [longitude, latitude, depth] = feature.geometry?.coordinates ?? [];
  const magnitude = feature.properties?.mag;
  // A feature with no position cannot be plotted and one with no magnitude cannot be sized. Both happen: the feed
  // carries events whose review is still in progress. Dropping them beats drawing a circle at 0°N 0°E.
  if (!feature.id || typeof latitude !== 'number' || typeof longitude !== 'number' || typeof magnitude !== 'number') {
    return undefined;
  }

  const place = feature.properties?.place ?? 'Unknown location';
  const depthKm = Math.max(Math.round(typeof depth === 'number' ? depth : 0), 0);
  const time = feature.properties?.time ?? 0;
  const significance = feature.properties?.sig ?? 0;

  return {
    id: feature.id,
    place,
    region: regionOf(place),
    magnitude: Math.round(magnitude * 10) / 10,
    magnitudeLabel: `M${magnitude.toFixed(1)}`,
    magnitudeType: feature.properties?.magType ?? '',
    depthKm,
    depthLabel: `${depthKm} km`,
    band: bandOf(depthKm),
    latitude,
    longitude,
    coordinates: `${hemisphere(latitude, 'N', 'S')} ${hemisphere(longitude, 'E', 'W')}`,
    time,
    ageLabel: ageOf(time, generatedAt),
    isFresh: generatedAt - time < HOUR,
    significance,
    significancePct: Math.min(Math.round(significance / 10), 100),
    tsunami: feature.properties?.tsunami === 1,
    alert: alertOf(feature.properties?.alert),
    felt: feature.properties?.felt ?? 0,
    intensity: intensityOf(feature.properties?.mmi),
    status: feature.properties?.status ?? 'automatic',
    network: (feature.properties?.net ?? '').toUpperCase(),
    url: feature.properties?.url ?? ''
  };
};

/**
 * Radiated energy, by the Gutenberg–Richter relation `log₁₀ E = 1.5 M + 4.8` (joules), as tonnes of TNT.
 *
 * A magnitude is a logarithm, and a reader adds logarithms wrong: two M5s are not a M10, and a single M7 outweighs a
 * thousand M5s. Summing energy is the one total of a window that means something physical — and it shows how much of
 * it the one big event carried.
 */
const TNT_JOULES_PER_TONNE = 4.184e9;

const energyOf = (quakes: Quake[]): Pick<WindowStats, 'energy' | 'energyUnit'> => {
  const tonnes = quakes.reduce((sum, quake) => sum + 10 ** (1.5 * quake.magnitude + 4.8), 0) / TNT_JOULES_PER_TONNE;
  if (tonnes >= 1e6) {
    return { energy: (tonnes / 1e6).toFixed(tonnes >= 1e7 ? 0 : 1), energyUnit: 'Mt TNT' };
  }

  if (tonnes >= 1e3) {
    return { energy: (tonnes / 1e3).toFixed(tonnes >= 1e4 ? 0 : 1), energyUnit: 'kt TNT' };
  }

  return { energy: tonnes.toFixed(tonnes >= 10 ? 0 : 1), energyUnit: 't TNT' };
};

const statsOf = (quakes: Quake[]): WindowStats => ({
  count: quakes.length,
  m6: quakes.filter(quake => quake.magnitude >= 6).length,
  tsunami: quakes.filter(quake => quake.tsunami).length,
  alerts: quakes.filter(quake => quake.alert !== 'none' && quake.alert !== 'green').length,
  ...energyOf(quakes)
});

/** The activity strip: every bin of the window, under every filter. */
const binsOf = (quakes: Quake[], window: FeedWindow, end: number): ActivityBin[] => {
  const { span, bin } = SPANS[window];
  const start = end - span;
  const total = Math.round(span / bin);
  const indexOf = (quake: Quake): number => Math.floor((quake.time - start) / bin);
  const counts = perFilter((floor, depth) => {
    const cells = Array.from({ length: total }, () => 0);
    quakes
      .filter(quake => passes(quake, floor.min, depth))
      .forEach(quake => {
        const index = indexOf(quake);
        if (index >= 0 && index < total) {
          cells[index] += 1;
        }
      });

    return { cells, busiest: Math.max(...cells, 0) };
  });

  return Array.from({ length: total }, (_, index) => ({
    id: `bin-${index}`,
    pct: perFilter((floor, depth) => {
      const { cells, busiest } = counts[floor.key][depth];

      return busiest ? Math.round((cells[index] / busiest) * 100) : 0;
    })
  }));
};

/**
 * Everything the page shows, from one request.
 *
 * Newest first, because a monitor is read from the top. Every total is over the whole window rather than what fits
 * on screen: a list cropped to eighty rows would otherwise decide what the counters say.
 */
export const seismicReport = async (window: FeedWindow): Promise<SeismicReport> => {
  const feed = FEEDS[window];
  const response = await fetch(feed.url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    // Thrown rather than answered with an empty report: an empty one reads as "a quiet day", and a quiet day and a
    // provider that refused are not the same page. Failing here is what makes the element report itself unresolved.
    throw new Error(`The USGS feed answered ${response.status}`);
  }

  const payload = (await response.json()) as { features?: Feature[]; metadata?: { generated?: number } };
  const generatedAt = payload.metadata?.generated ?? Date.now();
  const records = (payload.features ?? [])
    .map(entry => toQuake(entry, generatedAt))
    .filter((quake): quake is Quake => quake !== undefined)
    .sort((a, b) => b.time - a.time);

  return {
    window,
    windowLabel: SPANS[window].label,
    floorNote: feed.floorNote,
    records,
    isEmpty: records.length === 0,
    stats: perFilter((floor, depth) => statsOf(records.filter(quake => passes(quake, floor.min, depth)))),
    bins: binsOf(records, window, generatedAt),
    binLabel: SPANS[window].binLabel,
    axisStart: SPANS[window].axisStart,
    generatedAt,
    checkedAt: Date.now()
  };
};
