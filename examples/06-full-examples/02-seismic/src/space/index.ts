import { apiContainer, container, styles, text, variantFrom } from '@plitzi/sdk-authoring';

import { FEED_ACTION } from '../actions.ts';
import { activity, board, strongest } from './board.ts';
import { dock, legend, settingsBackdrop } from './controls.ts';
import { customCss } from './css.ts';
import { commandBar } from './header.ts';
import { log } from './log.ts';
import { MAP_DECLARATION, map, stage } from './map.ts';
import { computed, transientState } from './state.ts';
import { target } from './target.ts';
import { fonts, notifications, variables } from './tokens.ts';

import type { ElementSpec, SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * Tremor, declared: one screen, one server provider, one element of the space's own, and the instrument around it.
 *
 * The tree reads top to bottom as the display is layered: the server's answer wraps everything; inside it, the world's
 * outlines and the globe; above them, the heads-up display — seven panels on a grid, each in its own file. Element
 * ids, class names and flow chains are derived from what is written here, so authoring it twice writes byte-identical
 * documents, and the space would open in the builder exactly as it reads.
 */

/** The components this space ships, as their declarations: `main.ts` hands them to `authorSpace`, which checks them. */
export const PLUGINS = [MAP_DECLARATION];

const screen = styles('screen', {
  position: 'relative',
  width: '100%',
  height: '100dvh',
  overflow: 'hidden',
  'background-color': 'var(--void)',
  color: 'var(--ink)',
  'font-family': 'var(--mono)',
  // A ratio, not a length: the document's own line height is an absolute 24px, which every 10px caption inherited.
  'line-height': '1.35'
});

/**
 * The heads-up display: a grid over the globe that lets the pointer through.
 *
 * A full-bleed overlay that swallowed clicks would make the globe — the thing the reader came to drag — unreachable
 * everywhere a panel is not. The panels turn the pointer back on for themselves. The middle of the grid is empty on
 * purpose: that is where the world is.
 */
const hud = styles('hud', {
  css: {
    desktop: {
      position: 'absolute',
      inset: '0px',
      'z-index': '2',
      'pointer-events': 'none',
      padding: '18px 22px 20px',
      display: 'grid',
      'grid-template-columns': 'minmax(250px, 300px) minmax(0px, 1fr) minmax(290px, 350px)',
      'grid-template-rows': 'auto minmax(0px, 1fr) auto',
      'grid-template-areas': '"bar bar bar" "left . log" "legend . dock"',
      gap: '14px 18px'
    },
    // No room for the legend beside the totals: the left column takes the whole height instead.
    tablet: {
      'grid-template-columns': 'minmax(220px, 250px) minmax(0px, 1fr) minmax(250px, 290px)',
      'grid-template-areas': '"bar bar bar" "left . log" "left . dock"',
      padding: '14px',
      gap: '10px 12px'
    },
    mobile: {
      padding: '10px',
      gap: '8px',
      'grid-template-columns': 'minmax(0px, 1fr)',
      'grid-template-rows': 'auto minmax(0px, 1fr) auto auto',
      'grid-template-areas': '"bar" "." "target" "log"'
    }
  },
  // Read from across a room. `css.ts` scales the whole display by the variant; the margins are drawn tighter here
  // because they are scaled with it.
  variants: { wall: { padding: '14px 16px' }, tv: { padding: '10px 12px' } }
});

const leftColumn = styles('leftColumn', {
  css: {
    desktop: {
      'grid-area': 'left',
      display: 'flex',
      'flex-direction': 'column',
      gap: '14px',
      'min-height': '0px',
      'overflow-y': 'auto',
      'pointer-events': 'none',
      'scrollbar-width': 'none'
    },
    compact: { gap: '10px' },
    // On a phone the globe needs the room: the totals, the strongest card and the strip give way to the log.
    mobile: { display: 'none' }
  }
});

const logArea = styles('area-log', {
  css: {
    desktop: { 'grid-area': 'log', 'min-height': '0px', display: 'flex', 'flex-direction': 'column' },
    mobile: { 'max-height': '30vh' }
  }
});

/**
 * The dossier rises from the foot of the middle column into the empty band above it, over the globe, without taking
 * a row of its own: in the bottom row it made that row as tall as itself, and every panel beside it shrank whenever
 * something was locked. With no minimum height it contributes nothing to the grid's sizing.
 */
const targetArea = styles('area-target', {
  css: {
    desktop: {
      'grid-column': '2 / 3',
      'grid-row': '2 / 4',
      'min-height': '0px',
      display: 'flex',
      'align-items': 'flex-end',
      'justify-content': 'center'
    },
    mobile: { 'grid-area': 'target' }
  }
});

const legendArea = styles('area-legend', {
  css: { desktop: { 'grid-area': 'legend', 'align-self': 'end', display: 'flex' }, compact: { display: 'none' } }
});

const boot = styles('boot', {
  position: 'absolute',
  inset: '0px',
  'z-index': '10',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  'justify-content': 'center',
  gap: '18px',
  'pointer-events': 'none',
  'background-color': 'var(--void)'
});

const bootWord = styles('bootWord', {
  'font-family': 'var(--display)',
  'font-size': '44px',
  'font-weight': '700',
  'letter-spacing': '0.5em',
  'padding-left': '0.5em',
  color: 'var(--trace)',
  'text-shadow': '0 0 30px var(--trace-glow)'
});

const bootBar = styles('bootBar', {
  position: 'relative',
  width: '220px',
  height: '2px',
  'background-color': 'var(--edge-soft)',
  overflow: 'hidden'
});

const bootLine = styles('bootLine', {
  'font-family': 'var(--mono)',
  'font-size': '10px',
  'letter-spacing': '0.3em',
  'text-transform': 'uppercase',
  color: 'var(--dim)'
});

const outage = styles('outage', {
  'grid-area': '2 / 2 / 3 / 3',
  'align-self': 'center',
  'justify-self': 'center',
  padding: '14px 18px',
  'pointer-events': 'auto',
  border: '1px solid var(--shallow)',
  'background-color': 'var(--panel-strong)',
  'font-family': 'var(--mono)',
  'font-size': '11px',
  'letter-spacing': '0.16em',
  'text-transform': 'uppercase',
  'line-height': '1.7',
  'text-align': 'center',
  color: 'var(--shallow)'
});

const hudPanels = (): ElementSpec =>
  container({
    id: 'hud',
    class: hud,
    bind: [variantFrom(hud, 'computed.size', { template: "{{ source == 'desk' ? '' : source }}" })],
    children: [
      container({
        id: 'left-column',
        class: leftColumn,
        children: [board(), strongest(), activity()]
      }),
      commandBar(),
      container({ id: 'log-area', class: logArea, children: [log()] }),
      container({ id: 'legend-area', class: legendArea, children: [legend()] }),
      container({ id: 'target-area', class: targetArea, children: [target()] }),
      settingsBackdrop(),
      dock(),
      // A provider that could not answer is not a quiet planet, and the two must never look alike.
      text({
        id: 'feed-outage',
        content: 'USGS feed unreachable — the server keeps asking every 30 s',
        class: outage,
        visible: 'feed.hasError'
      }),
      text({
        id: 'feed-empty',
        content: 'No events in this window yet',
        class: outage,
        visible: {
          source: 'feed.isEmpty',
          template: "{{ source and not apiContainer_feed.hasError ? 'true' : 'false' }}"
        }
      })
    ]
  });

const monitor: ElementSpec = apiContainer({
  id: 'feed',
  // A tag of its own, or `stage` has nothing to position: a provider left without one renders its children alone.
  subType: 'div',
  class: stage,
  /**
   * Resolved on the server while the page is built, so the finished HTML already carries the window's events — and
   * asked again on the reader's cadence, which re-runs the same render action for the provider's own slice. Live data
   * with no second endpoint, no socket and no credential in the page.
   */
  runtime: 'server',
  action: FEED_ACTION,
  // The reader's cadence — 10, 30 or 60 seconds, or 0 to hold still. The provider re-arms its timer when it changes.
  bind: { refreshSeconds: 'computed.refresh' },
  /**
   * Keep drawing while a new window loads. A server provider otherwise holds its children back until the payload for
   * the new address lands — which would tear down the globe and build it again on every window switch.
   */
  renderWhileLoading: true,
  children: [
    apiContainer({
      id: 'atlas',
      subType: 'div',
      class: stage,
      // The world's outlines, a static file this server serves. Cached for the day: coastlines do not move.
      query: '/geo/world.json',
      cache: true,
      staleTime: 86400,
      children: [map]
    }),
    hudPanels()
  ]
});

const bootScreen = (): ElementSpec =>
  container({
    id: 'boot',
    class: boot,
    children: [
      text({ content: 'TREMOR', class: bootWord }),
      text({ content: '', class: bootBar }),
      text({ content: 'Global seismic surveillance', class: bootLine })
    ]
  });

export const space: SpaceSpec = {
  name: 'Tremor',
  permanentUrl: 'tremor',
  // Server-resolved elements are off unless a space says otherwise, and a space whose provider is fed by the server
  // and does not declare this renders from mock data with nothing anywhere reporting a missing switch.
  rsc: { enabled: true },
  /**
   * Both schemes, following the visitor's machine until they pick one — and the pick is kept. A monitor is read in a
   * dark room, until it is put on a projector in a lit one, which is exactly where this display gets shown: the switch
   * is on the display itself, not in a settings page.
   */
  theme: { default: 'system', schemes: ['light', 'dark'] },
  fonts,
  variables,
  notifications,
  computed,
  customCss,
  settings: { keepState: true, stateStorage: 'localStorage', transientState },
  pages: [
    {
      name: 'Monitor',
      slug: '',
      seoTitle: 'Tremor — global seismic surveillance',
      seoDescription:
        'Every earthquake the USGS publishes, live on a globe: filter by window and magnitude, lock on to any event.',
      class: screen,
      body: [monitor, bootScreen()]
    }
  ]
};
