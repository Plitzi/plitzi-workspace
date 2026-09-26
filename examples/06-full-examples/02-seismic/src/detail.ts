/**
 * One earthquake, looked at closely: how hard the ground shook around it, how the fault moved, and how it ranks among
 * everything the region has had since 1900.
 *
 * Four USGS answers joined into one — the event's own page, its ShakeMap contours, and two questions put to the FDSN
 * catalogue — which is exactly the read a single request cannot express and a server action can. Each part is fetched
 * on its own and fails on its own: an event with no ShakeMap still has a history, and a catalogue that is slow today
 * still leaves the shaking on the map.
 */

const USGS_HOST = 'earthquake.usgs.gov';
const DETAIL_URL = `https://${USGS_HOST}/earthquakes/feed/v1.0/detail`;
const FDSN_URL = `https://${USGS_HOST}/fdsnws/event/1`;

/** How far around an event its history is read, from when, and from what size an earthquake counts. */
export const HISTORY = { radiusKm: 300, since: 1900, minMagnitude: 5 } as const;

const TIMEOUT_MS = 8000;

/** Up to this place an event is ranked by its place in line; past it, by the share of the record it beats. */
const RANKED_BY_PLACE = 20;
const CACHE_MS = 10 * 60 * 1000;
/** An answer still missing its ShakeMap or moment tensor: the USGS publishes those tens of minutes after the event. */
const INCOMPLETE_CACHE_MS = 60 * 1000;
const CACHE_SIZE = 200;

/** A USGS event id — letters and digits (`us7000tiqc`) — and nothing that could become a path or a query. */
const EVENT_ID = /^[a-z0-9]{4,40}$/i;

export const isEventId = (value: unknown): value is string => typeof value === 'string' && EVENT_ID.test(value);

/** A line of equal shaking: every point on it felt the ground move at `mmi` on the Modified Mercalli scale. */
export type ShakingLevel = { mmi: number; lines: [number, number][][] };

export type Faulting = 'thrust' | 'normal' | 'strike-slip';

export type QuakeDetail = {
  id: string;
  /** The ShakeMap's contours, strongest last — `null` when the USGS has not made one (most events below M4). */
  shaking: { id: string; levels: ShakingLevel[] } | null;
  /** `VI · STRONG`, from the strongest shaking the ShakeMap estimates — or what people reported, when it has none. */
  shakingLabel: string;
  faulting: Faulting | null;
  faultingLabel: string;
  /** How many reported feeling it ("Did You Feel It?"). */
  feltLabel: string;
  history: {
    count: number;
    /** 1 for the strongest in the region since 1900; `null` when this one is below the size the history counts. */
    rank: number | null;
    largest: { id: string; magnitude: string; year: number; place: string }[];
  } | null;
  historyLabel: string;
  rankLabel: string;
  largestLabel: string;
};

const MMI_WORDS = [
  '',
  'NOT FELT',
  'WEAK',
  'WEAK',
  'LIGHT',
  'MODERATE',
  'STRONG',
  'VERY STRONG',
  'SEVERE',
  'VIOLENT',
  'EXTREME',
  'EXTREME',
  'EXTREME'
];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export const mmiLabel = (mmi: number): string => {
  const level = Math.min(12, Math.max(1, Math.round(mmi)));

  return `${ROMAN[level]} · ${MMI_WORDS[level]}`;
};

/** Which way the fault moved, from the rake of the moment tensor's first nodal plane. */
export const faultingOf = (rake: number): Faulting => {
  if (rake > 45 && rake < 135) {
    return 'thrust';
  }

  return rake < -45 && rake > -135 ? 'normal' : 'strike-slip';
};

const FAULTING_LABELS: Record<Faulting, string> = {
  thrust: 'THRUST · ONE SIDE PUSHED OVER THE OTHER',
  normal: 'NORMAL · THE CRUST PULLED APART',
  'strike-slip': 'STRIKE-SLIP · THE SIDES SLID PAST'
};

const ordinal = (value: number): string => {
  const tens = value % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] ?? 'th');

  return `${value}${suffix}`;
};

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const numberOf = (value: unknown): number | null => {
  const parsed = typeof value === 'string' ? Number(value) : value;

  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};

/** Only the USGS, over HTTPS: a URL read out of an answer is still a URL somebody else wrote. */
const getJson = async (url: string): Promise<unknown> => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== USGS_HOST) {
    throw new Error(`Refused to fetch ${parsed.origin}: only ${USGS_HOST} is read`);
  }

  const response = await fetch(parsed, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`${parsed.pathname} answered ${response.status}`);
  }

  return response.json();
};

/** A coordinate to a hundredth of a degree — about a kilometre, finer than a contour is drawn at any zoom. */
const round = (value: number): number => Math.round(value * 100) / 100;

const isPosition = (value: unknown): value is [number, number] =>
  Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number';

/** One contour line, with the points closer than a hundredth of a degree to the one before dropped. */
const thin = (line: unknown): [number, number][] => {
  if (!Array.isArray(line)) {
    return [];
  }

  const points: [number, number][] = [];
  for (const position of line) {
    if (!isPosition(position)) {
      continue;
    }

    const point: [number, number] = [round(position[0]), round(position[1])];
    const last = points.at(-1);
    if (!last || last[0] !== point[0] || last[1] !== point[1]) {
      points.push(point);
    }
  }

  return points;
};

const shakingLevels = (collection: unknown): ShakingLevel[] => {
  const features = isRecord(collection) && Array.isArray(collection.features) ? collection.features : [];

  return features
    .flatMap((feature: unknown): ShakingLevel[] => {
      if (!isRecord(feature) || !isRecord(feature.geometry) || !isRecord(feature.properties)) {
        return [];
      }

      const mmi = numberOf(feature.properties.value);
      const { type, coordinates } = feature.geometry;
      const raw = type === 'MultiLineString' && Array.isArray(coordinates) ? coordinates : [coordinates];
      const lines = raw.map(thin).filter(line => line.length > 1);

      return mmi === null || !lines.length ? [] : [{ mmi, lines }];
    })
    .sort((a, b) => a.mmi - b.mmi);
};

const contentUrl = (product: unknown, file: string): string | null => {
  if (!isRecord(product) || !isRecord(product.contents)) {
    return null;
  }

  const entry = product.contents[file];

  return isRecord(entry) && typeof entry.url === 'string' ? entry.url : null;
};

const firstProduct = (products: unknown, name: string): unknown =>
  isRecord(products) && Array.isArray(products[name]) ? products[name][0] : undefined;

const fdsn = (path: 'count' | 'query', params: Record<string, string | number>): string =>
  `${FDSN_URL}/${path}?${new URLSearchParams({ format: 'geojson', ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])) }).toString()}`;

const historyOf = async (latitude: number, longitude: number, magnitude: number): Promise<QuakeDetail['history']> => {
  const around = {
    latitude: round(latitude),
    longitude: round(longitude),
    maxradiuskm: HISTORY.radiusKm,
    starttime: `${HISTORY.since}-01-01`
  };
  const counts = (answer: unknown): number => (isRecord(answer) ? (numberOf(answer.count) ?? 0) : 0);
  const [all, stronger, top] = await Promise.all([
    getJson(fdsn('count', { ...around, minmagnitude: HISTORY.minMagnitude })),
    magnitude >= HISTORY.minMagnitude
      ? getJson(fdsn('count', { ...around, minmagnitude: Math.round(magnitude * 100 + 1) / 100 }))
      : Promise.resolve(null),
    getJson(fdsn('query', { ...around, minmagnitude: HISTORY.minMagnitude, orderby: 'magnitude', limit: 3 }))
  ]);
  const features = isRecord(top) && Array.isArray(top.features) ? top.features : [];

  return {
    count: counts(all),
    rank: stronger === null ? null : counts(stronger) + 1,
    largest: features.flatMap((feature: unknown) => {
      if (!isRecord(feature) || !isRecord(feature.properties)) {
        return [];
      }

      const mag = numberOf(feature.properties.mag);
      const time = numberOf(feature.properties.time);
      const place = typeof feature.properties.place === 'string' ? feature.properties.place : '';

      return mag === null || time === null
        ? []
        : [{ id: String(feature.id), magnitude: `M${mag.toFixed(1)}`, year: new Date(time).getUTCFullYear(), place }];
    })
  };
};

const rankLabelOf = (past: QuakeDetail['history']): string => {
  if (!past) {
    return '';
  }

  if (past.rank === null) {
    return `BELOW M${HISTORY.minMagnitude}: NOT RANKED`;
  }

  if (past.rank === 1) {
    return 'THE STRONGEST HERE ON RECORD';
  }

  // Past the first few a place in line says little ("623rd"); what share of the region's record it beats says more.
  if (past.rank > RANKED_BY_PLACE) {
    const beaten = Math.round(((past.count - past.rank) / Math.max(past.count, 1)) * 100);

    return `STRONGER THAN ${beaten}% OF M${HISTORY.minMagnitude}+ HERE`;
  }

  return `${ordinal(past.rank).toUpperCase()} STRONGEST HERE ON RECORD`;
};

const settled = <T>(result: PromiseSettledResult<T>): T | null => (result.status === 'fulfilled' ? result.value : null);

const describe = async (id: string): Promise<QuakeDetail> => {
  const event = await getJson(`${DETAIL_URL}/${id}.geojson`);
  const properties = isRecord(event) && isRecord(event.properties) ? event.properties : {};
  const geometry = isRecord(event) && isRecord(event.geometry) ? event.geometry : {};
  const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  const [longitude, latitude] = [numberOf(coordinates[0]), numberOf(coordinates[1])];
  const magnitude = numberOf(properties.mag) ?? 0;
  const shakemapUrl = contentUrl(firstProduct(properties.products, 'shakemap'), 'download/cont_mmi.json');
  const tensor = firstProduct(properties.products, 'moment-tensor');
  const rake =
    isRecord(tensor) && isRecord(tensor.properties) ? numberOf(tensor.properties['nodal-plane-1-rake']) : null;

  const [contours, history] = await Promise.allSettled([
    shakemapUrl ? getJson(shakemapUrl) : Promise.resolve(null),
    latitude !== null && longitude !== null ? historyOf(latitude, longitude, magnitude) : Promise.resolve(null)
  ]);
  const levels = shakingLevels(settled(contours));
  const shaking = levels.length ? { id, levels } : null;
  const peak = numberOf(properties.mmi) ?? numberOf(properties.cdi);
  const felt = numberOf(properties.felt);
  const faulting = rake === null ? null : faultingOf(rake);
  const past = settled(history);
  const largest = past?.largest.at(0);

  return {
    id,
    shaking,
    shakingLabel: peak === null ? 'NO ESTIMATE' : mmiLabel(peak),
    faulting,
    faultingLabel: faulting ? FAULTING_LABELS[faulting] : 'NO MOMENT TENSOR YET',
    feltLabel: felt ? `${felt.toLocaleString('en-US')} REPORTED FEELING IT` : 'NO REPORTS',
    history: past,
    historyLabel: past
      ? `${past.count.toLocaleString('en-US')} QUAKES ≥ M${HISTORY.minMagnitude} WITHIN ${HISTORY.radiusKm} KM SINCE ${HISTORY.since}`
      : 'CATALOGUE UNAVAILABLE',
    rankLabel: rankLabelOf(past),
    largestLabel: largest ? `LARGEST ${largest.magnitude} · ${largest.year} · ${largest.place.toUpperCase()}` : ''
  };
};

/**
 * An event's detail, remembered for ten minutes — or one, while it is incomplete.
 *
 * Selecting, releasing and selecting the same event again is what a person looking at a map does; the USGS need
 * not be asked each time. But an event minutes old has no ShakeMap or moment tensor yet, and an answer saying so must
 * not outlive their publication by long: a live monitor is looked at exactly when something just happened. A failed
 * read is not remembered, so the next selection tries again.
 */
const cache = new Map<string, { at: number; ttl: number; detail: Promise<QuakeDetail> }>();

export const quakeDetail = (id: string): Promise<QuakeDetail> => {
  const now = Date.now();
  const hit = cache.get(id);
  if (hit && now - hit.at < hit.ttl) {
    return hit.detail;
  }

  if (cache.size >= CACHE_SIZE) {
    cache.delete(cache.keys().next().value ?? '');
  }

  const detail = describe(id);
  const entry = { at: now, ttl: INCOMPLETE_CACHE_MS, detail };
  cache.set(id, entry);
  detail.then(
    answer => {
      entry.ttl = answer.shaking && answer.faulting ? CACHE_MS : INCOMPLETE_CACHE_MS;
    },
    () => cache.delete(id)
  );

  return detail;
};
