import {
  apiContainer,
  authorSpace,
  container,
  defineElement,
  heading,
  link,
  list,
  styles,
  text
} from '@plitzi/sdk-authoring';

import { customCss, variables } from './theme';

import type { ElementSpec, SpaceSpec } from '@plitzi/sdk-authoring';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * A live seismic monitor, declared.
 *
 * One page, one provider, one element of the space's own. Nothing here fetches anything: the tree names a server
 * action and `authorSpace` derives everything nobody chooses — element ids, class names, parent and root links,
 * the breakpoint maps. The space would open in the builder exactly as it reads here.
 *
 * The classes are declared with `styles()` where they are used rather than gathered in a theme file, because this
 * space is one screen: the rule for the readout and the readout itself belong together, and a name declared twice
 * with different rules is refused. Only what describes the whole display — the palette, and the parts of the
 * map element nobody authored — lives in `theme.ts`.
 */

/** The map. Not in the SDK and never will be: a projection is this deployment's business. */
const seismicMap = defineElement<{
  events?: unknown;
  refreshSeconds?: number;
  selectionKey?: string;
  showGraticule?: boolean;
}>({ type: 'seismicMap', content: { definition: { label: 'Seismic Map' } } });

// ── The display ────────────────────────────────────────────────────────────────────────────────────────────────

const screen = styles('screen', {
  position: 'relative',
  width: '100%',
  height: '100vh',
  overflow: 'hidden',
  'background-color': 'var(--void)',
  color: 'var(--phosphor)',
  'font-family': 'var(--mono)'
});

/**
 * Every layer above the map sits in this one, and it lets the pointer through.
 *
 * A full-bleed overlay that swallowed clicks would make the map — the only interactive thing on the page —
 * unreachable everywhere a panel is not. The panels turn it back on for themselves.
 */
const overlay = styles('overlay', {
  position: 'absolute',
  top: '0px',
  right: '0px',
  bottom: '0px',
  left: '0px',
  // Above the map. Leaflet stacks its own panes up to 800 and the tooltip pane to 650, so an overlay that did not
  // say where it goes was painted underneath the world it is annotating.
  'z-index': '900',
  'pointer-events': 'none',
  // Extra at the foot so nothing important sits under the dev-tools badge in the corner.
  padding: '22px 22px 46px',
  display: 'grid',
  'grid-template-columns': 'minmax(220px, 300px) 1fr minmax(240px, 330px)',
  'grid-template-rows': 'auto 1fr auto',
  gap: '18px'
});

const mapLayer = styles('mapLayer', {
  position: 'absolute',
  top: '0px',
  right: '0px',
  bottom: '0px',
  left: '0px'
});

const panel = styles('panel', {
  'pointer-events': 'auto',
  'background-color': 'var(--panel)',
  border: '1px solid var(--edge)',
  'backdrop-filter': 'blur(6px)',
  padding: '14px 16px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px'
});

const stack = styles('stack', { display: 'flex', 'flex-direction': 'column', gap: '18px', 'min-height': '0px' });

/**
 * The event column, and the reason it is capped.
 *
 * A scrollbar is not a length: a list that fills the screen buries the map behind it and still needs scrolling on
 * a busy day, so it is worth exactly as much of the display as a reader takes in at a glance. The rest is one
 * scroll away and the map keeps the room.
 */
const rightStack = styles('rightStack', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '18px',
  'min-height': '0px',
  'max-height': '54vh',
  'grid-column': '3',
  'grid-row': '1'
});

// ── Type ───────────────────────────────────────────────────────────────────────────────────────────────────────

const wordmark = styles('wordmark', {
  'font-family': 'var(--display)',
  'font-size': '30px',
  'font-weight': '700',
  'letter-spacing': '0.34em',
  color: 'var(--phosphor)',
  'text-shadow': '0 0 18px var(--phosphor-glow)',
  margin: '0px'
});

const legendLabel = styles('legendLabel', {
  'font-size': '10px',
  'letter-spacing': '0.24em',
  'text-transform': 'uppercase',
  color: 'var(--dim)'
});

const readoutValue = styles('readoutValue', {
  'font-family': 'var(--display)',
  'font-size': '26px',
  'font-weight': '700',
  'letter-spacing': '0.04em',
  color: 'var(--phosphor)'
});

const bodyText = styles('bodyText', { 'font-size': '12px', 'line-height': '1.55', color: 'var(--ink)' });

const statusRow = styles('statusRow', {
  display: 'flex',
  'align-items': 'center',
  gap: '10px',
  'font-size': '10px',
  'letter-spacing': '0.18em',
  'text-transform': 'uppercase',
  color: 'var(--dim)'
});

/** The one moving thing that is not data: it says the page is still listening. */
const pulseDot = styles('pulseDot', {
  width: '7px',
  height: '7px',
  'border-radius': '999px',
  'background-color': 'var(--alert)',
  'box-shadow': '0 0 10px var(--alert)',
  'flex-shrink': '0'
});

// ── Readouts ───────────────────────────────────────────────────────────────────────────────────────────────────

const statGrid = styles('statGrid', { display: 'grid', 'grid-template-columns': '1fr 1fr 1fr', gap: '1px' });

const statCell = styles('statCell', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
  padding: '8px 10px',
  'background-color': 'var(--cell)'
});

const rangeRow = styles('rangeRow', { display: 'flex', gap: '1px' });

const rangeBase = {
  flex: '1',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '2px',
  padding: '6px 4px',
  'font-size': '10px',
  'letter-spacing': '0.18em',
  'text-transform': 'uppercase',
  'text-decoration': 'none'
};

const rangeLink = styles('rangeLink', {
  ...rangeBase,
  color: 'var(--dim)',
  'background-color': 'var(--cell)',
  border: '1px solid transparent'
});

/** The range being shown. A different SHAPE, not a tint on the same one: it is a state, not an emphasis. */
const rangeLinkOn = styles('rangeLinkOn', {
  ...rangeBase,
  color: 'var(--void)',
  'background-color': 'var(--phosphor)',
  'font-weight': '700',
  border: '1px solid var(--phosphor)'
});

// ── The event column ───────────────────────────────────────────────────────────────────────────────────────────

const feedPanel = styles('feedPanel', {
  'pointer-events': 'auto',
  'background-color': 'var(--panel)',
  border: '1px solid var(--edge)',
  'backdrop-filter': 'blur(6px)',
  padding: '14px 0px 6px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'min-height': '0px',
  flex: '1'
});

/** The panel's padding is on its rows, so its heading needs its own — the list has to reach the edges to scroll. */
const feedHead = styles('feedHead', { padding: '0px 14px 6px' });

const feedList = styles('feedList', {
  display: 'flex',
  'flex-direction': 'column',
  overflow: 'hidden auto',
  'padding-left': '0px',
  'min-height': '0px',
  flex: '1'
});

const eventRow = styles('eventRow', {
  display: 'grid',
  'grid-template-columns': 'auto 1fr auto',
  'align-items': 'baseline',
  gap: '10px',
  padding: '6px 14px',
  'border-bottom': '1px solid var(--edge-soft)',
  'text-decoration': 'none',
  color: 'var(--ink)'
});

// Left-aligned and its own width: a fixed right-aligned column reads as an indent on every row, and the numbers
// here are all four characters wide anyway.
const magnitudeBadge = styles('magnitudeBadge', {
  'font-family': 'var(--display)',
  'font-size': '15px',
  'font-weight': '700',
  color: 'var(--phosphor)'
});

const rowRegion = styles('rowRegion', {
  'font-size': '11px',
  color: 'var(--ink)',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap'
});

const rowMeta = styles('rowMeta', { 'font-size': '9.5px', 'letter-spacing': '0.12em', color: 'var(--dim)' });

// ── Selection and legend ───────────────────────────────────────────────────────────────────────────────────────

const selectionPanel = styles('selectionPanel', {
  'pointer-events': 'auto',
  'grid-column': '2',
  'grid-row': '3',
  'justify-self': 'center',
  'align-self': 'end',
  'min-width': '380px',
  'background-color': 'var(--panel-strong)',
  border: '1px solid var(--phosphor-edge)',
  'box-shadow': '0 0 40px -12px var(--phosphor-glow)',
  padding: '14px 18px',
  display: 'grid',
  'grid-template-columns': 'auto 1fr',
  'column-gap': '18px',
  'row-gap': '4px'
});

const selectionMagnitude = styles('selectionMagnitude', {
  'font-family': 'var(--display)',
  'font-size': '44px',
  'font-weight': '700',
  'line-height': '1',
  color: 'var(--phosphor)',
  'grid-row': '1 / span 3',
  'align-self': 'center',
  'text-shadow': '0 0 22px var(--phosphor-glow)'
});

const depthKey = styles('depthKey', {
  'grid-column': '1',
  'grid-row': '3',
  'align-self': 'end',
  'pointer-events': 'auto',
  'background-color': 'var(--panel)',
  border: '1px solid var(--edge)',
  padding: '10px 14px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '6px'
});

/**
 * One class per band, coloured from the same custom property the map draws that band with.
 *
 * Four declarations rather than one class and an `nth-child` rule: the key's position in the DOM is not a fact
 * about what a colour MEANS, and a rule that depended on it broke the moment a row moved.
 */
const swatchFor = (band: string) =>
  styles(`swatch-${band}`, {
    width: '16px',
    height: '3px',
    'flex-shrink': '0',
    'background-color': `var(--depth-${band})`
  });

const keyRow = styles('keyRow', {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  'font-size': '10px',
  'letter-spacing': '0.1em',
  color: 'var(--dim)'
});

/** The one glyph on the map that is not a fact about an event's position. */
const keyNote = styles('keyNote', {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  'margin-top': '4px',
  'padding-top': '8px',
  'border-top': '1px solid var(--edge-soft)',
  'font-size': '10px',
  'letter-spacing': '0.1em',
  color: 'var(--dim)'
});

const keyRing = styles('keyRing', {
  width: '12px',
  height: '12px',
  'border-radius': '999px',
  border: '1px solid var(--phosphor)',
  'flex-shrink': '0'
});

const emptyNotice = styles('emptyNotice', {
  'grid-column': '2',
  'grid-row': '2',
  'align-self': 'center',
  'justify-self': 'center',
  'font-size': '12px',
  'letter-spacing': '0.2em',
  'text-transform': 'uppercase',
  color: 'var(--dim)'
});

// ── Pieces ─────────────────────────────────────────────────────────────────────────────────────────────────────

const label = (content: string): ElementSpec => text({ content, class: legendLabel });

const stat = (caption: string, source: string): ElementSpec =>
  container({
    class: statCell,
    children: [label(caption), text({ content: '', class: readoutValue, bind: { content: source } })]
  });

/** A swatch whose colour comes from the same custom property the map draws that depth band with. */
const keyEntry = (band: string, caption: string): ElementSpec =>
  container({
    class: keyRow,
    meta: { label: `Depth ${band}` },
    children: [text({ content: '', class: swatchFor(band) }), text({ content: caption })]
  });

/** The magnitude floor, in the chip. Smaller and quieter than the range: it qualifies it, it is not the choice. */
const rangeFloorOn = styles('rangeFloorOn', { 'font-size': '8.5px', 'letter-spacing': '0.1em', opacity: '0.7' });

const rangeFloor = styles('rangeFloor', {
  'font-size': '8.5px',
  'letter-spacing': '0.1em',
  color: 'var(--dim)',
  opacity: '0.8'
});

/**
 * Two chips per range, and the binding picks.
 *
 * The current one is a different shape rather than the same one tinted, so the control reads as a switch with a
 * position rather than as three links one of which happens to be brighter. Both are authored and the data decides
 * which is on screen — a binding shows an element when a field is true, and comparing two values is not something
 * it can do.
 *
 * **Each chip states its magnitude floor**, because these are three different datasets and not three lengths of
 * the same one: a day of everything is a few hundred events and a month of everything is tens of thousands, so
 * the longer ranges drop the small ones. Unlabelled, the control looks broken — a M3 in California is on the
 * week and gone from the month, and nothing on screen says why.
 */
const range = (slug: string, caption: string, floor: string, flag: string): ElementSpec[] => [
  link({
    href: `/?window=${slug}`,
    mode: 'internal',
    class: rangeLinkOn,
    visible: `feed.${flag}`,
    children: [text({ content: caption }), text({ content: floor, class: rangeFloorOn })]
  }),
  link({
    href: `/?window=${slug}`,
    mode: 'internal',
    class: rangeLink,
    visible: `!feed.${flag}`,
    children: [text({ content: caption }), text({ content: floor, class: rangeFloor })]
  })
];

// ── The page ───────────────────────────────────────────────────────────────────────────────────────────────────

const monitor: ElementSpec = apiContainer({
  idRef: 'feed',
  /**
   * Resolved on the server while the page is built, so the finished HTML already carries the last day of
   * earthquakes: no request from the browser, nothing to load after the paint, and the USGS never learns who is
   * watching. The map asks THIS server again on a timer; the feed itself is never reached from a page.
   */
  runtime: 'server',
  action: 'seismic-feed',
  // What this element asks of the action, on top of the page's own route and query params — which is how
  // `/?window=hour` reaches the task with nothing wired between the URL and the flow.
  input: { limit: 60 },
  class: mapLayer,
  children: [
    seismicMap({
      idRef: 'map',
      /**
       * Rendered in the browser and nowhere else.
       *
       * A map library needs a document, so there is nothing the server could usefully produce here — and saying
       * so is better than letting it try: the page is built without this element and the browser fills it in,
       * rather than the server importing a module that reaches for `window` and falling back after it throws.
       */
      runtime: 'client',
      class: mapLayer,
      bind: { events: 'feed.records' },
      refreshSeconds: 45,
      selectionKey: 'selected'
    }),

    container({
      class: overlay,
      children: [
        // Top left: what this is, and whether it is still listening.
        container({
          class: stack,
          children: [
            container({
              class: panel,
              children: [
                heading({ content: 'TREMOR', subType: 'h1', class: wordmark }),
                text({ content: 'Global seismic monitor · USGS', class: legendLabel }),
                container({
                  class: statusRow,
                  children: [
                    text({ content: '', class: pulseDot }),
                    text({ content: '', bind: { content: 'feed.windowLabel' } }),
                    text({ content: '·' }),
                    text({ content: '', bind: { content: 'feed.updatedLabel' } })
                  ]
                }),
                container({
                  class: rangeRow,
                  children: [
                    ...range('day', '24h', 'all', 'isDay'),
                    ...range('week', '7d', 'M2.5+', 'isWeek'),
                    ...range('month', '30d', 'M4.5+', 'isMonth')
                  ]
                })
              ]
            }),
            container({
              class: panel,
              children: [
                label('Window totals'),
                container({
                  class: statGrid,
                  children: [
                    stat('Events', 'feed.total'),
                    stat('M6+', 'feed.notable'),
                    stat('Significant', 'feed.felt')
                  ]
                })
              ]
            }),
            // The one fact the page exists to state, so it is the one that never scrolls out of view.
            container({
              class: panel,
              visible: 'feed.hasStrongest',
              children: [
                label('Strongest in window'),
                text({ content: '', class: readoutValue, bind: { content: 'feed.strongest.magnitudeLabel' } }),
                text({ content: '', class: bodyText, bind: { content: 'feed.strongest.place' } })
              ]
            })
          ]
        }),

        // Right: everything, newest first.
        container({
          class: rightStack,
          children: [
            container({
              class: feedPanel,
              children: [
                container({ class: feedHead, children: [label('Latest events')] }),
                /**
                 * The list renders its one child once per record, each row under its own scope — which is what
                 * `eventRows.item` is. One template, however many events.
                 */
                list({
                  idRef: 'eventRows',
                  source: 'controlled',
                  class: feedList,
                  bind: { items: 'feed.records' },
                  children: [
                    link({
                      mode: 'external',
                      target: 'blank',
                      class: eventRow,
                      bind: { href: 'eventRows.item.url' },
                      children: [
                        text({ content: '', class: magnitudeBadge, bind: { content: 'eventRows.item.magnitudeLabel' } }),
                        text({ content: '', class: rowRegion, bind: { content: 'eventRows.item.region' } }),
                        text({ content: '', class: rowMeta, bind: { content: 'eventRows.item.depthLabel' } })
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }),

        // Bottom left: what the colours mean. Static, because a key that came from the data could be wrong.
        container({
          class: depthKey,
          children: [
            label('Focal depth'),
            keyEntry('shallow', '0 – 33 km'),
            keyEntry('upper', '33 – 70 km'),
            keyEntry('mid', '70 – 300 km'),
            keyEntry('deep', '300 km +'),
            container({
              class: keyNote,
              children: [text({ content: '', class: keyRing }), text({ content: 'Ring: logged in the last 20 min' })]
            })
          ]
        }),

        /**
         * The map is the only thing that knows what the pointer is over, and it writes the event into
         * `runtime.state.selected`. This panel is an ordinary container binding to it — the same seam an
         * interaction's `setState` writes through, so nothing about the plugin is private.
         */
        container({
          class: selectionPanel,
          visible: 'state.selected.id',
          children: [
            text({ content: '', class: selectionMagnitude, bind: { content: 'state.selected.magnitudeLabel' } }),
            text({ content: '', class: legendLabel, bind: { content: 'state.selected.region' } }),
            text({ content: '', class: bodyText, bind: { content: 'state.selected.place' } }),
            container({
              class: statusRow,
              children: [
                text({ content: '', bind: { content: 'state.selected.depthLabel' } }),
                text({ content: 'deep' }),
                text({ content: '·' }),
                text({ content: 'sig' }),
                text({ content: '', bind: { content: 'state.selected.significance' } })
              ]
            })
          ]
        }),

        // A quiet hour is a real answer, and it is not the same page as a provider that never replied.
        text({ content: 'No events in this window', class: emptyNotice, visible: 'feed.isEmpty' })
      ]
    })
  ]
});

export const seismic: SpaceSpec = {
  name: 'Tremor',
  permanentUrl: 'tremor',
  // Server-resolved elements are off unless a space says otherwise, and a space whose provider is fed by the
  // server and does not declare this renders from mock data with nothing anywhere reporting a missing switch.
  rsc: { enabled: true },
  /**
   * One scheme, deliberately. A monitor is read in a dark room and its whole legibility is a bright trace on a
   * black field, so offering a light one would be offering a version of this display that does not work.
   */
  theme: { default: 'dark', schemes: ['dark'] },
  variables,
  customCss,
  pages: [
    {
      name: 'Monitor',
      slug: '',
      seoTitle: 'Tremor — global seismic monitor',
      seoDescription: 'Every earthquake the USGS has published in the last day, on one screen.',
      class: screen,
      body: [monitor]
    }
  ]
};

export const offlineData = (): OfflineDataRaw => authorSpace(seismic);
