import {
  bindTemplate,
  button,
  container,
  list,
  onClick,
  setState,
  styles,
  text,
  variantFrom
} from '@plitzi/sdk-authoring';

import { BUTTON_RESET, PANEL, caption, label, readout, sectionContent, sectionHeader } from './kit.ts';
import { shown } from './state.ts';

import type { BindingSpec, ElementSpec } from '@plitzi/sdk-authoring';

/**
 * The left of the display: the window in four numbers, the one event it exists to point at, and when it happened.
 *
 * Every number is the server's — counted under every magnitude floor and depth band in `feed.ts` — and the page only
 * picks the one for the filters the reader chose: `stats[computed.floor][computed.depth]`. A counter that filtered two
 * thousand rows in a template on every refresh would be the same number, slower.
 */

const boardPanel = styles('boardPanel', { ...PANEL, gap: '12px' });

const statGrid = styles('statGrid', {
  display: 'grid',
  'grid-template-columns': 'repeat(4, minmax(0px, 1fr))',
  gap: '1px',
  'background-color': 'var(--edge-soft)'
});

const statCell = styles('statCell', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '6px',
  padding: '9px 8px 10px',
  'background-color': 'var(--panel-strong)'
});

/** A count that is zero on a quiet day and a headline when it is not: it turns the alarm colour above zero. */
const alarmReadout = styles('alarmReadout', {
  css: {
    'font-family': 'var(--display)',
    'font-size': '24px',
    'font-weight': '700',
    'line-height': '1',
    color: 'var(--dim)',
    'font-variant-numeric': 'tabular-nums'
  },
  variants: { alarm: { color: 'var(--shallow)', 'text-shadow': '0 0 16px var(--shallow)' } }
});

const energyRow = styles('energyRow', {
  display: 'flex',
  'align-items': 'baseline',
  'justify-content': 'space-between',
  gap: '10px',
  'padding-top': '10px',
  'border-top': '1px solid var(--edge-soft)'
});

const energyValue = styles('energyValue', {
  'font-family': 'var(--display)',
  'font-size': '18px',
  'font-weight': '600',
  color: 'var(--ink)',
  'font-variant-numeric': 'tabular-nums'
});

/** A caption narrow enough for four to a row: the same voice as `caption`, with less air between the letters. */
const statLabel = styles('statLabel', {
  'font-family': 'var(--mono)',
  'font-size': '9px',
  'letter-spacing': '0.12em',
  'text-transform': 'uppercase',
  color: 'var(--dim)',
  'white-space': 'nowrap'
});

const stat = (id: string, name: string, value: BindingSpec, alarm?: BindingSpec): ElementSpec =>
  container({
    id,
    class: statCell,
    children: [
      text({ content: name, class: statLabel }),
      text({
        id: `${id}-value`,
        content: '',
        class: alarm ? alarmReadout : readout,
        bind: alarm ? [value, alarm] : [value]
      })
    ]
  });

/** One of the window's totals under the reader's filters. */
const total = (field: string): string => `{{ source[computed.floor][computed.depth].${field} }}`;

const alarmAbove = (field: string): BindingSpec =>
  variantFrom(alarmReadout, 'feed.stats', {
    template: `{{ source[computed.floor][computed.depth].${field} > 0 ? 'alarm' : '' }}`
  });

const DEPTH_NAMES = "{ 'all': '', 'shallow': ' · shallow', 'intermediate': ' · mid', 'deep': ' · deep' }";

export const board = (): ElementSpec =>
  container({
    id: 'board',
    class: boardPanel,
    children: [
      sectionHeader(
        'totals',
        'Totals',
        text({
          id: 'board-scope',
          content: '',
          class: caption,
          bind: [
            bindTemplate(
              'content',
              'feed.windowLabel',
              `{{ source }} · {{ computed.minMagnitude > 0 ? 'M' ~ computed.minMagnitude ~ '+' : 'all' }}{{ ${DEPTH_NAMES}[computed.depth] }}`
            )
          ]
        })
      ),
      sectionContent('totals', [
        container({
          class: statGrid,
          children: [
            stat('stat-events', 'Events', bindTemplate('content', 'feed.stats', total('count'))),
            stat('stat-m6', 'M6+', bindTemplate('content', 'feed.stats', total('m6')), alarmAbove('m6')),
            stat(
              'stat-tsunami',
              'Tsunami',
              bindTemplate('content', 'feed.stats', total('tsunami')),
              alarmAbove('tsunami')
            ),
            stat('stat-pager', 'PAGER', bindTemplate('content', 'feed.stats', total('alerts')), alarmAbove('alerts'))
          ]
        }),
        container({
          id: 'energy',
          class: energyRow,
          children: [
            label('Energy released'),
            text({
              id: 'energy-value',
              content: '',
              class: energyValue,
              bind: [bindTemplate('content', 'feed.stats', `${total('energy')} ${total('energyUnit')}`)]
            })
          ]
        })
      ])
    ]
  });

// ── The strongest event ────────────────────────────────────────────────────────────────────────────────────────────

/** The panel around the card: it keeps its header when the card folds, or when nothing passes the filters. */
const strongestPanel = styles('strongestPanel', { ...PANEL, gap: '10px' });

/** The card itself — the body of the panel, and the button that locks the map on the event. */
const strongestCard = styles('strongestCard', {
  css: {
    ...BUTTON_RESET,
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--edge-soft)',
    'background-color': 'var(--cell)',
    display: 'grid',
    'grid-template-columns': 'auto 1fr',
    'column-gap': '14px',
    'row-gap': '4px',
    'align-items': 'center',
    transition: 'border-color 160ms linear, box-shadow 160ms linear'
  },
  states: {
    hover: { 'border-color': 'var(--trace)', 'box-shadow': '0 0 30px -12px var(--trace-glow)' },
    'focus-visible': { outline: '1px solid var(--trace)', 'outline-offset': '3px' }
  },
  // Locked: this is the event the dossier is describing, and the card says so instead of offering to lock it again.
  variants: { locked: { 'border-color': 'var(--trace)', 'box-shadow': 'inset 3px 0 0 var(--trace)' } }
});

const cardHead = styles('cardHead', {
  'grid-column': '1 / -1',
  display: 'flex',
  'justify-content': 'flex-end',
  'align-items': 'baseline',
  gap: '10px'
});

const cardAction = styles('cardAction', {
  css: { 'font-family': 'var(--mono)', 'font-size': '10px', 'letter-spacing': '0.2em', color: 'var(--trace)' },
  variants: { locked: { color: 'var(--dim)' } }
});

/** A magnitude in its depth colour — the one fact the dot on the map and this number have to agree on. */
export const bandMagnitude = styles('bandMagnitude', {
  css: {
    'font-family': 'var(--display)',
    'font-size': '40px',
    'font-weight': '700',
    'line-height': '1',
    'grid-row': 'span 2',
    color: 'var(--deep)',
    'font-variant-numeric': 'tabular-nums'
  },
  variants: {
    shallow: { color: 'var(--shallow)', 'text-shadow': '0 0 20px var(--shallow)' },
    intermediate: { color: 'var(--intermediate)', 'text-shadow': '0 0 20px var(--intermediate)' },
    deep: { color: 'var(--deep)', 'text-shadow': '0 0 20px var(--deep)' }
  }
});

const cardRegion = styles('cardRegion', {
  'font-family': 'var(--display)',
  'font-size': '17px',
  'font-weight': '600',
  'line-height': '1.15',
  color: 'var(--ink)'
});

const cardMeta = styles('cardMeta', {
  'font-family': 'var(--mono)',
  'font-size': '10px',
  'letter-spacing': '0.1em',
  color: 'var(--dim)',
  'font-variant-numeric': 'tabular-nums'
});

const strongestSlot = styles('strongestSlot', { margin: '0px', padding: '0px', 'list-style-type': 'none' });

/** The largest event that passes the reader's filters: the log's own predicate, sorted by size, cropped to one. */
const strongestShown = `{{ source|filter(q => ${shown('q')})|sort((a, b) => b.magnitude - a.magnitude)|slice(0, 1) }}`;

const isLockedStrongest = "{{ source == list_strongestPick.item.id ? 'locked' : '' }}";

/**
 * The largest event of the window, as a button: pressing it locks the map on it.
 *
 * It is the same act as clicking the dot or a row of the log — one `setState` of the one key all three read — so the
 * dossier, the reticle and the flight to it come with it for free. A list of at most one, filtered by the same test
 * as every other panel: the strongest SHALLOW event when the reader filtered to shallow ones, and nothing at all when
 * nothing passes — never a card pointing at an event the map is not showing.
 */
const noneShown = `{{ source is defined and (source|filter(q => ${shown('q')})|length) == 0 ? 'true' : 'false' }}`;

const emptyCard = styles('emptyCard', {
  'font-family': 'var(--mono)',
  'font-size': '10px',
  'letter-spacing': '0.14em',
  'text-transform': 'uppercase',
  color: 'var(--dim)'
});

export const strongest = (): ElementSpec =>
  container({
    id: 'strongest-panel',
    class: strongestPanel,
    children: [
      sectionHeader('strongest', 'Strongest in window'),
      sectionContent('strongest', [
        list({
          id: 'strongestPick',
          source: 'controlled',
          class: strongestSlot,
          bind: [bindTemplate('items', 'feed.records', strongestShown, { returns: 'value' })],
          children: [
            container({
              subType: 'li',
              class: strongestSlot,
              children: [
                button({
                  id: 'strongest',
                  content: '',
                  title: 'Lock the map on the strongest event that passes the filters',
                  class: strongestCard,
                  bind: [variantFrom(strongestCard, 'state.selectedId', { template: isLockedStrongest })],
                  flows: [
                    [
                      onClick(),
                      setState({ key: 'selectedId', type: 'text', value: '{{ list_strongestPick.item.id }}' })
                    ]
                  ],
                  children: [
                    container({
                      class: cardHead,
                      children: [
                        text({
                          id: 'strongest-action',
                          content: '',
                          class: cardAction,
                          bind: [
                            bindTemplate(
                              'content',
                              'state.selectedId',
                              "{{ source == list_strongestPick.item.id ? '■ LOCKED' : 'LOCK ▸' }}"
                            ),
                            variantFrom(cardAction, 'state.selectedId', { template: isLockedStrongest })
                          ]
                        })
                      ]
                    }),
                    text({
                      id: 'strongest-magnitude',
                      content: '',
                      class: bandMagnitude,
                      bind: [
                        { to: 'content', source: 'strongestPick.item.magnitudeLabel' },
                        variantFrom(bandMagnitude, 'strongestPick.item.band')
                      ]
                    }),
                    text({
                      id: 'strongest-region',
                      content: '',
                      class: cardRegion,
                      bind: { content: 'strongestPick.item.region' }
                    }),
                    text({
                      id: 'strongest-meta',
                      content: '',
                      class: cardMeta,
                      bind: [
                        bindTemplate(
                          'content',
                          'strongestPick.item',
                          "{{ source.time|date('d M · H:i', 'UTC')|upper }} UTC · {{ source.depthLabel }} · {{ source.ageLabel }} ago"
                        )
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }),
        text({
          id: 'strongest-none',
          content: 'Nothing passes these filters',
          class: emptyCard,
          visible: { source: 'feed.records', template: noneShown }
        })
      ])
    ]
  });

// ── Activity ───────────────────────────────────────────────────────────────────────────────────────────────────────

const activityPanel = styles('activityPanel', { ...PANEL, gap: '8px' });

const bars = styles('bars', {
  display: 'flex',
  'align-items': 'flex-end',
  gap: '2px',
  height: '52px',
  margin: '0px',
  padding: '0px',
  'list-style-type': 'none'
});

const barSlot = styles('barSlot', {
  flex: '1',
  display: 'flex',
  'align-items': 'flex-end',
  height: '100%',
  'min-width': '0px'
});

/** One bar. Its height is a style binding over the server's per-floor share, so moving the floor redraws the strip. */
const bar = styles('bar', {
  width: '100%',
  'min-height': '1px',
  'background-color': 'var(--trace)',
  opacity: '0.75',
  'box-shadow': '0 0 8px -2px var(--trace-glow)',
  transition: 'height 280ms ease-out'
});

const axis = styles('axis', {
  display: 'flex',
  'justify-content': 'space-between',
  'font-family': 'var(--mono)',
  'font-size': '9px',
  'letter-spacing': '0.16em',
  color: 'var(--dim)'
});

export const activity = (): ElementSpec =>
  container({
    id: 'activity',
    class: activityPanel,
    children: [
      sectionHeader(
        'activity',
        'Activity',
        text({ id: 'activity-bins', content: '', class: caption, bind: { content: 'feed.binLabel' } })
      ),
      sectionContent('activity', [
        list({
          id: 'bins',
          source: 'controlled',
          class: bars,
          bind: { items: 'feed.bins' },
          children: [
            container({
              subType: 'li',
              class: barSlot,
              children: [
                container({
                  class: bar,
                  bind: [
                    bindTemplate('height', 'bins.item.pct', '{{ source[computed.floor][computed.depth] }}%', {
                      category: 'style'
                    })
                  ]
                })
              ]
            })
          ]
        }),
        container({
          class: axis,
          children: [text({ id: 'axis-start', content: '', bind: { content: 'feed.axisStart' } }), text('NOW')]
        })
      ])
    ]
  });
