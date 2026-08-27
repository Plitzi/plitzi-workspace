/**
 * The USGS feed, and the shape a page can actually draw.
 *
 * GeoJSON is a transport format: a `features` array of `geometry.coordinates` triples and a `properties` bag with
 * eighteen fields, most of which describe how the measurement was made. A map needs six of them, in the units it
 * draws in. Reshaping that is real work, so it is a TASK rather than a template — a twig expression pretending to
 * flatten GeoJSON would be a worse example than the honest version, and this is the file a reader of the example
 * should be able to skim without knowing what a `magType` is.
 *
 * Everything here runs on the SERVER. The browser never talks to the USGS: the page is built with the answer
 * already in it, and the refresh below asks this same server again.
 */

/**
 * No key, no quota, updated every minute. Three windows, each at the magnitude the window can carry.
 *
 * The threshold rises with the range on purpose. A day of everything the USGS records is a few hundred events; a
 * month of it is tens of thousands, most of them below the level anyone felt — a page of that is not more
 * information, it is the same map with the coastlines buried. So a week drops what is under M2.5 and a month what
 * is under M4.5, which is the level the USGS itself treats as reportable worldwide.
 */
const FEEDS = {
  day: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
  week: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
  month: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson'
} as const;

export type FeedWindow = keyof typeof FEEDS;

export const isFeedWindow = (value: unknown): value is FeedWindow => typeof value === 'string' && value in FEEDS;

/** One event, in the units the map and the readout use. Nothing else from the feed survives. */
export type Quake = {
  id: string;
  /** The USGS one-line description, e.g. "18 km SSE of Volcano, Hawaii". */
  place: string;
  /** Just the region half of it, for a column that has no room for the distance. */
  region: string;
  magnitude: number;
  /**
   * The same two numbers as text, because a readout is not a plot.
   *
   * `4` and `4.0` are the same magnitude and only one of them is how a seismologist writes it, and a depth column
   * of bare integers reads as a count of something. The map wants the numbers; a column wants the units. Formatted
   * here so every visitor sees the same string and no page has to know the convention.
   */
  magnitudeLabel: string;
  /** Kilometres below the surface. Shallow quakes are the destructive ones, which is why the map colours by it. */
  depthKm: number;
  depthLabel: string;
  latitude: number;
  longitude: number;
  /** Milliseconds since the epoch, as the feed gives it — the page formats, the server does not guess a timezone. */
  time: number;
  /** USGS's own significance score, 0–1000. Anything over 600 is an event people will have heard about. */
  significance: number;
  /** Whether a tsunami warning was issued alongside it. */
  tsunami: boolean;
  url: string;
};

export type SeismicReport = {
  records: Quake[];
  /** The strongest event in the window, for the readout that leads with it. An empty object when there are none. */
  strongest: Quake | Record<string, never>;
  hasStrongest: boolean;
  isEmpty: boolean;
  total: number;
  /**
   * How many crossed magnitude 6 — the level at which a shallow event damages buildings.
   *
   * Not 4.5, which is the threshold the month feed already filters on: a count of the events that got through the
   * filter is a count of the rows, and a readout that always equals the one beside it says nothing.
   */
  notable: number;
  felt: number;
  /**
   * The window this report covers, a phrase naming it, and one flag per range.
   *
   * The flags are what the range control binds to: a chip cannot decide it is the current one, because a binding
   * compares nothing — it shows an element when a field is true. So the answer says which range it IS.
   */
  window: FeedWindow;
  windowLabel: string;
  isDay: boolean;
  isWeek: boolean;
  isMonth: boolean;
  /** When the FEED was generated, not when this ran: the difference is how stale the answer is. */
  generatedAt: number;
  updatedLabel: string;
};

type Feature = {
  id?: string;
  properties?: {
    place?: string | null;
    mag?: number | null;
    time?: number | null;
    sig?: number | null;
    tsunami?: number | null;
    felt?: number | null;
    url?: string | null;
  };
  geometry?: { coordinates?: (number | null)[] };
};

const WINDOW_LABELS: Record<FeedWindow, string> = {
  day: 'LAST 24 H · ALL',
  week: 'LAST 7 D · M2.5+',
  month: 'LAST 30 D · M4.5+'
};

/**
 * The half of a place name worth showing in a narrow column.
 *
 * USGS writes "18 km SSE of Volcano, Hawaii". The distance and bearing are precision nobody reads at a glance and
 * they push the part that identifies the event off the end of the row.
 */
const regionOf = (place: string): string => {
  const separator = place.indexOf(' of ');

  return separator === -1 ? place : place.slice(separator + 4);
};

const toQuake = (feature: Feature): Quake | undefined => {
  const [longitude, latitude, depth] = feature.geometry?.coordinates ?? [];
  const magnitude = feature.properties?.mag;
  // A feature with no position cannot be plotted and one with no magnitude cannot be sized. Both happen: the feed
  // carries events whose review is still in progress. Dropping them beats drawing a circle at 0°N 0°E.
  if (!feature.id || typeof latitude !== 'number' || typeof longitude !== 'number' || typeof magnitude !== 'number') {
    return undefined;
  }

  const place = feature.properties?.place ?? 'Unknown location';

  return {
    id: feature.id,
    place,
    region: regionOf(place),
    magnitude: Math.round(magnitude * 10) / 10,
    magnitudeLabel: `M${magnitude.toFixed(1)}`,
    depthKm: Math.round(typeof depth === 'number' ? depth : 0),
    depthLabel: `${Math.round(typeof depth === 'number' ? depth : 0)} km`,
    latitude,
    longitude,
    time: feature.properties?.time ?? 0,
    significance: feature.properties?.sig ?? 0,
    tsunami: feature.properties?.tsunami === 1,
    url: feature.properties?.url ?? ''
  };
};

/** "3 min ago", in the words a monitor uses. Computed on the server, so every visitor reads the same clock. */
const ago = (from: number, now: number): string => {
  const seconds = Math.max(Math.round((now - from) / 1000), 0);
  if (seconds < 90) {
    return `${seconds}s AGO`;
  }

  const minutes = Math.round(seconds / 60);

  return minutes < 90 ? `${minutes}m AGO` : `${Math.round(minutes / 60)}h AGO`;
};

/**
 * Everything the page shows, from one request.
 *
 * Newest first, because a monitor is read from the top. `strongest` is picked over the whole window rather than
 * over what fits on screen: the largest event of the day is the one fact the page exists to state, and a list
 * cropped to twenty rows would hide it whenever the day was busy.
 */
export const seismicReport = async (window: FeedWindow, limit: number): Promise<SeismicReport> => {
  const response = await fetch(FEEDS[window], { headers: { accept: 'application/json' } });
  if (!response.ok) {
    // Thrown rather than answered with an empty report: an empty one reads as "a quiet day", and a quiet day and a
    // provider that refused are not the same page. Failing here is what makes the element report itself unresolved.
    throw new Error(`The USGS feed answered ${response.status}`);
  }

  const payload = (await response.json()) as { features?: Feature[]; metadata?: { generated?: number } };
  const all = (payload.features ?? []).map(toQuake).filter((quake): quake is Quake => quake !== undefined);
  const ordered = [...all].sort((a, b) => b.time - a.time);
  const strongest = [...all].sort((a, b) => b.magnitude - a.magnitude)[0];
  const generatedAt = payload.metadata?.generated ?? Date.now();

  return {
    records: ordered.slice(0, limit),
    strongest: strongest ?? {},
    hasStrongest: Boolean(strongest),
    isEmpty: all.length === 0,
    total: all.length,
    notable: all.filter(quake => quake.magnitude >= 6).length,
    felt: all.filter(quake => quake.significance >= 600).length,
    window,
    windowLabel: WINDOW_LABELS[window],
    isDay: window === 'day',
    isWeek: window === 'week',
    isMonth: window === 'month',
    generatedAt,
    updatedLabel: ago(generatedAt, Date.now())
  };
};
