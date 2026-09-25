/**
 * Every filter the display offers, in one place both halves read.
 *
 * The server counts and bins each window at every combination of MAGNITUDE and DEPTH, and the page draws one chip per
 * entry and filters by the same keys. Written twice, a chip added on one side would filter the list and leave every
 * counter reading zero on the other.
 */

export const FLOORS = [
  { key: 'm0', label: 'ALL', min: 0 },
  { key: 'm25', label: '2.5+', min: 2.5 },
  { key: 'm4', label: '4+', min: 4 },
  { key: 'm5', label: '5+', min: 5 },
  { key: 'm6', label: '6+', min: 6 }
] as const;

export type Floor = (typeof FLOORS)[number];

export type FloorKey = Floor['key'];

/** What the page starts on: small enough to see the Ring of Fire, big enough not to bury it under Californian M1s. */
export const DEFAULT_FLOOR: FloorKey = 'm25';

/** Focal depth, as a filter: every band, or one of the three the map colours by. */
export const DEPTHS = [
  { key: 'all', label: 'ALL' },
  { key: 'shallow', label: 'SHALLOW' },
  { key: 'intermediate', label: 'MID' },
  { key: 'deep', label: 'DEEP' }
] as const;

export type DepthKey = (typeof DEPTHS)[number]['key'];

/**
 * What counts as news while the page is open: an event this big arriving raises an alert and, when the reader lets
 * it, takes the map to it. Independent of the display's own floor — a reader can watch everything and be told only
 * about the M4s. `off` is a threshold no earthquake reaches.
 */
export const ALERTS = [
  { key: 'off', label: 'OFF', min: 99 },
  { key: 'm25', label: '2.5+', min: 2.5 },
  { key: 'm4', label: '4+', min: 4 },
  { key: 'm5', label: '5+', min: 5 },
  { key: 'm6', label: '6+', min: 6 }
] as const;

export const DEFAULT_ALERT = 'm4';

/** How often the page asks the server again. `0` holds the display still — a paused monitor says so. */
export const REFRESH = [
  { seconds: 10, label: '10S' },
  { seconds: 30, label: '30S' },
  { seconds: 60, label: '60S' },
  { seconds: 0, label: 'PAUSE' }
] as const;

export const DEFAULT_REFRESH = 30;

/** One value per magnitude floor and depth band — read by a binding as `stats[computed.floor][computed.depth]`. */
export const perFilter = <T>(value: (floor: Floor, depth: DepthKey) => T): Record<FloorKey, Record<DepthKey, T>> =>
  // `fromEntries` widens its keys to `string`; they are every key of FLOORS and DEPTHS by construction.
  Object.fromEntries(
    FLOORS.map(floor => [floor.key, Object.fromEntries(DEPTHS.map(depth => [depth.key, value(floor, depth.key)]))])
  ) as Record<FloorKey, Record<DepthKey, T>>;

/** The same test the page's templates apply, for the server's counts. */
export const passes = (quake: { magnitude: number; band: string }, min: number, depth: DepthKey): boolean =>
  quake.magnitude >= min && (depth === 'all' || quake.band === depth);
