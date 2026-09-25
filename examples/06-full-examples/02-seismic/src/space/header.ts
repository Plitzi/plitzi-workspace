import {
  bindTemplate,
  container,
  heading,
  link,
  onClick,
  setState,
  styles,
  text,
  variantFrom
} from '@plitzi/sdk-authoring';

import { DEPTHS, FLOORS } from '../filters.ts';
import { PANEL, caption, chip, chipButton, segmented } from './kit.ts';

import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * The command bar: one line across the top of the display, holding what this is, whether it is listening, and the
 * filters.
 *
 * One line because the filters are consulted, not read: on a wall or a TV the globe is the picture, and a block of
 * chips above it was the second-largest thing on screen. The three filters — window, magnitude, depth — sit in the bar
 * because they change every panel at once and a reader reaches for them constantly. How the page BEHAVES — how often
 * it asks, what counts as news — is set once and left, so it lives behind the gear in the corner.
 *
 * The window is a different mechanism from the rest on purpose. It decides what the server fetches, so it is a link —
 * `/?window=week` — and the render action reads it from the query string; the page moves without reloading and the
 * server answers for the new address. Everything else only decides what is shown of an answer already on the page, so
 * it is state, and every panel filters by it the instant it changes.
 */

const bar = styles('commandBar', {
  css: {
    desktop: {
      ...PANEL,
      'grid-area': 'bar',
      'flex-direction': 'row',
      'flex-wrap': 'wrap',
      'align-items': 'center',
      'justify-content': 'space-between',
      gap: '10px 22px',
      padding: '8px 14px',
      // Full screen and the gear sit over the bar's end (see `settingsCorner`): their room is kept free here.
      'padding-right': '108px'
    },
    mobile: { 'justify-content': 'flex-start', padding: '8px 10px', 'padding-right': '98px' }
  }
});

/** Wraps rather than running under the corner buttons: on a phone the status drops below the wordmark. */
const brandBlock = styles('brandBlock', {
  display: 'flex',
  'flex-wrap': 'wrap',
  'align-items': 'center',
  gap: '8px 14px',
  'min-width': '0px'
});

const wordmark = styles('wordmark', {
  margin: '0px',
  'font-family': 'var(--display)',
  'font-size': '24px',
  'font-weight': '700',
  'line-height': '1',
  'letter-spacing': '0.34em',
  color: 'var(--trace)',
  'text-shadow': '0 0 20px var(--trace-glow)'
});

const statusStack = styles('statusStack', { display: 'flex', 'flex-direction': 'column', gap: '3px' });

const statusRow = styles('statusRow', {
  display: 'flex',
  'flex-wrap': 'wrap',
  'align-items': 'center',
  gap: '4px 8px',
  'font-family': 'var(--mono)',
  'font-size': '10px',
  'letter-spacing': '0.14em',
  'text-transform': 'uppercase',
  color: 'var(--dim)',
  'font-variant-numeric': 'tabular-nums',
  'white-space': 'nowrap'
});

/** The one moving thing that is not data: it says the page is still listening — and goes still when it is not. */
const liveDot = styles('liveDot', {
  css: {
    width: '7px',
    height: '7px',
    'border-radius': '999px',
    'background-color': 'var(--shallow)',
    'box-shadow': '0 0 10px var(--shallow)',
    'flex-shrink': '0'
  },
  variants: { paused: { 'background-color': 'var(--dim)', 'box-shadow': 'none' } }
});

const liveWord = styles('liveWord', {
  css: { color: 'var(--shallow)', 'font-weight': '700' },
  variants: { paused: { color: 'var(--dim)' } }
});

/** A fact about the link rather than about the Earth, so it wears the depth scale's warning colour. */
const linkWarning = styles('linkWarning', {
  'font-family': 'var(--mono)',
  'font-size': '9.5px',
  'letter-spacing': '0.14em',
  'text-transform': 'uppercase',
  color: 'var(--intermediate)'
});

const filterCluster = styles('filterCluster', {
  display: 'flex',
  'flex-wrap': 'wrap',
  'align-items': 'center',
  'justify-content': 'center',
  gap: '8px 14px'
});

const filterGroup = styles('filterGroup', { display: 'flex', 'align-items': 'center', gap: '8px' });

const floorNote = styles('floorNote', {
  'font-family': 'var(--mono)',
  'font-size': '9.5px',
  'letter-spacing': '0.12em',
  'text-transform': 'uppercase',
  color: 'var(--intermediate)'
});

/** A depth chip carries the band's own colour as a dot, so the filter and the legend are one vocabulary. */
const bandDot = styles('bandDot', {
  css: { width: '7px', height: '7px', 'border-radius': '999px', 'background-color': 'currentColor' },
  variants: {
    shallow: { 'background-color': 'var(--shallow)' },
    intermediate: { 'background-color': 'var(--intermediate)' },
    deep: { 'background-color': 'var(--deep)' }
  }
});

/** The windows the feed offers. The server reads the same four names; one it does not know falls back to a day. */
const WINDOWS = [
  { key: 'hour', label: '1H', hint: 'Last hour, every magnitude' },
  { key: 'day', label: '24H', hint: 'Last 24 hours, every magnitude' },
  { key: 'week', label: '7D', hint: 'Last 7 days, every magnitude' },
  { key: 'month', label: '30D', hint: 'Last 30 days — the USGS publishes M2.5 and up' }
] as const;

const group = (name: string, id: string, chips: ElementSpec[]): ElementSpec =>
  container({
    class: filterGroup,
    children: [text({ content: name, class: caption }), container({ id, class: segmented, children: chips })]
  });

const paused = "{{ source == 0 ? 'paused' : '' }}";

const brand = (): ElementSpec =>
  container({
    id: 'brand',
    class: brandBlock,
    children: [
      heading({ id: 'wordmark', content: 'TREMOR', subType: 'h1', class: wordmark }),
      container({
        class: statusStack,
        children: [
          container({
            id: 'link-status',
            class: statusRow,
            children: [
              text({
                content: '',
                class: liveDot,
                bind: [variantFrom(liveDot, 'computed.refresh', { template: paused })]
              }),
              text({
                id: 'live-word',
                content: '',
                class: liveWord,
                bind: [
                  bindTemplate('content', 'computed.refresh', "{{ source == 0 ? 'Paused' : 'Live' }}"),
                  variantFrom(liveWord, 'computed.refresh', { template: paused })
                ]
              }),
              text({
                id: 'feed-checked',
                content: '',
                bind: [bindTemplate('content', 'feed.checkedAt', "Checked {{ source|date('H:i:s', 'UTC') }} UTC")]
              })
            ]
          }),
          /**
           * How old the news is, apart from how recently anybody asked: the USGS regenerates its feed once a minute,
           * so the checked time above moves on every refresh and this one only when there is something new to read.
           */
          container({
            id: 'feed-age',
            class: statusRow,
            children: [
              text({
                id: 'feed-clock',
                content: '',
                bind: [bindTemplate('content', 'feed.generatedAt', "USGS feed {{ source|date('H:i:s', 'UTC') }}")]
              }),
              text({
                id: 'feed-cadence',
                content: '',
                bind: [
                  bindTemplate(
                    'content',
                    'computed.refresh',
                    "{{ source == 0 ? '· on hold' : '· every ' ~ source ~ ' s' }}"
                  )
                ]
              })
            ]
          }),
          // The last refresh could not reach the server: what is on screen is from before, and a monitor must say so.
          text({
            id: 'link-stale',
            content: 'Link degraded — last good feed',
            class: linkWarning,
            visible: 'feed.isStale'
          }),
          text({ id: 'link-retasking', content: 'Retasking…', class: linkWarning, visible: 'feed.isLoading' })
        ]
      })
    ]
  });

const displayFilters = (): ElementSpec =>
  container({
    id: 'filters',
    class: filterCluster,
    children: [
      group(
        'Window',
        'window-switch',
        WINDOWS.map(window =>
          link({
            id: `window-${window.key}`,
            href: `/?window=${window.key}`,
            mode: 'internal',
            label: window.hint,
            class: chip,
            // The server's answer says which window it IS, so the chip that lights is the data's, not the URL's — a
            // window somebody mistyped shows the day it fell back to.
            bind: [variantFrom(chip, 'feed.window', { template: `{{ source == '${window.key}' ? 'on' : '' }}` })],
            children: [text(window.label)]
          })
        )
      ),
      group(
        'Mag',
        'floor-switch',
        FLOORS.map(floor =>
          chipButton({
            id: `floor-${floor.key}`,
            content: floor.label,
            hint: floor.min ? `Every panel: magnitude ${floor.min} and above` : 'Every panel: every magnitude',
            source: 'computed.floor',
            on: `source == '${floor.key}'`,
            flow: [onClick(), setState({ key: 'floor', type: 'text', value: floor.key })]
          })
        )
      ),
      group(
        'Depth',
        'depth-switch',
        DEPTHS.map(depth =>
          chipButton({
            id: `depth-${depth.key}`,
            content: depth.label,
            hint: depth.key === 'all' ? 'Every panel: every depth' : `Every panel: ${depth.key} events only`,
            source: 'computed.depth',
            on: `source == '${depth.key}'`,
            flow: [onClick(), setState({ key: 'depth', type: 'text', value: depth.key })],
            ...(depth.key === 'all' ? {} : { lead: text({ content: '', class: bandDot, variant: depth.key }) })
          })
        )
      ),
      text({
        id: 'floor-note',
        content: '',
        class: floorNote,
        bind: { content: 'feed.floorNote' },
        visible: 'feed.floorNote'
      })
    ]
  });

export const commandBar = (): ElementSpec =>
  container({ id: 'command-bar', class: bar, children: [brand(), displayFilters()] });
