import { ALERTS, DEFAULT_ALERT, DEFAULT_FLOOR, DEFAULT_REFRESH, FLOORS } from '../filters.ts';

/**
 * The display's state: what the reader chose, and the values every panel derives from it.
 *
 * Keys in `runtime.state`, written by flows. Each switch is named for the way it LEAVES its default — `platesOff`,
 * `spinOff`, `followOff` — because `toggleState` turns a key nobody has set yet ON: a key named for the default would
 * take a first click to do nothing at all.
 *
 * Nothing reads those keys directly. Every panel reads `computed`, where each default is applied once, so a switch
 * nobody has touched still shows its default as chosen, and "the floor" means the same number in the list, the map,
 * the counters and the activity strip.
 */

/**
 * The panels a reader can fold away, each under a `<section>Collapsed` key — named for how it leaves its default, since
 * every panel starts open — and read back as `computed.<section>Open`.
 */
export const SECTIONS = ['totals', 'strongest', 'activity', 'log', 'legend'] as const;

export type SectionKey = (typeof SECTIONS)[number];

const sectionsOpen = Object.fromEntries(
  SECTIONS.map(section => [`${section}Open`, `{{ state.${section}Collapsed ? false : true }}`])
);

const table = (entries: readonly { key: string; min: number }[]): string =>
  entries.map(entry => `'${entry.key}': ${entry.min}`).join(', ');

export const computed = {
  /** The magnitude floor's key and the depth band — `stats[computed.floor][computed.depth]` is a counter's number. */
  floor: `{{ state.floor ?? '${DEFAULT_FLOOR}' }}`,
  depth: "{{ state.depth ?? 'all' }}",
  /** The same floor as a magnitude, for the filters. */
  minMagnitude: `{{ { ${table(FLOORS)} }[computed.floor] }}`,
  /** How often the page asks again, in seconds; `0` is paused. */
  refresh: `{{ state.refresh ?? ${DEFAULT_REFRESH} }}`,
  /** What counts as news while the page is open, and whether news takes the map to it. */
  alert: `{{ state.alert ?? '${DEFAULT_ALERT}' }}`,
  alertMagnitude: `{{ { ${table(ALERTS)} }[computed.alert] }}`,
  follow: '{{ state.followOff ? false : true }}',
  /** The log's own order and search — they narrow the list, not the display. */
  sort: "{{ state.sort ?? 'newest' }}",
  search: "{{ (state.search ?? '')|trim|lower }}",
  projection: "{{ state.projection ?? 'globe' }}",
  /** How big the display is drawn: at arm's length, on a wall, across a room. Each screen keeps its own. */
  size: "{{ state.size ?? 'desk' }}",
  plates: '{{ state.platesOff ? false : true }}',
  density: '{{ state.densityOn ? true : false }}',
  /** Only a globe turns: on a flat map turning is scrolling sideways off the data, so it is off whatever was chosen. */
  rotate: "{{ state.spinOff or computed.projection == 'flat' ? false : true }}",
  replaying: '{{ state.replay ? true : false }}',
  /** Whether the settings panel is open. Starts closed, and is never kept: a panel open on arrival is in the way. */
  settingsOpen: '{{ state.settingsOpen ? true : false }}',
  /** Whether each panel is open. A flag that HIDES: until it is written, the panel shows. */
  ...sectionsOpen
};

/**
 * The test every panel applies to an event, as twig — written once, so the map, the log, the strongest card and the
 * log's count cannot disagree about what "shown" means. `q` is whatever the template calls the event.
 */
export const shown = (q: string): string =>
  `${q}.magnitude >= computed.minMagnitude and (computed.depth == 'all' or ${q}.band == computed.depth)`;

/**
 * Kept across reloads: what the reader set the display to. Not kept: what they were looking at.
 *
 * A lock restored on the next visit points at an event that may have left the window, a replay restored halfway is a
 * display that starts doing something by itself, and a search restored is a log that looks broken.
 */
export const transientState = ['selectedId', 'replay', 'search', 'settingsOpen'];
