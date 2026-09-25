import {
  bindTemplate,
  button,
  container,
  formControl,
  list,
  named,
  on,
  onClick,
  setState,
  styles,
  text,
  variantFrom
} from '@plitzi/sdk-authoring';

import { BUTTON_RESET, PANEL, caption, chipButton, heading, segmented } from './kit.ts';
import { shown } from './state.ts';

import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * The contact log: every event that passes the display's filters, and each one a way to lock the map on it.
 *
 * On top of those it has two of its own, because they are questions only a list asks: a search by place — "anything
 * near Tonga?" — and an order, newest first for a monitor or strongest first for a briefing. They narrow the LOG; the
 * map and the counters keep answering for the whole filtered window.
 *
 * The rows are the server's list filtered by a template that hands over its VALUE — `returns: 'value'` — so the list
 * receives the filtered array itself and renders only what passes. Moving the floor re-filters two thousand events in
 * well under a millisecond; hiding rows one by one would have left every hidden row in the DOM.
 */

const matching = `source|filter(q => ${shown('q')} and (computed.search == '' or computed.search in (q.place|lower)))`;

/** The same rows, in the reader's order, cropped to what a column can hold. */
const rowsShown = `{{ (computed.sort == 'strongest' ? (${matching})|sort((a, b) => b.magnitude - a.magnitude) : ${matching})|slice(0, 80) }}`;

const logTools = styles('logTools', { display: 'flex', 'align-items': 'center', gap: '8px' });

/** The search box. Its input is dressed in `css.ts`: a form control's inner `<input>` is not a selector a class reaches. */
const logSearch = styles('logSearch', { flex: '1', 'min-width': '0px', margin: '0px' });

const logPanel = styles('logPanel', {
  ...PANEL,
  padding: '14px 0px 0px',
  gap: '8px',
  'min-height': '0px',
  overflow: 'hidden'
});

/** The panel's padding is on its rows, so the parts above them need their own — the list has to reach the edges. */
const logHead = styles('logHead', { display: 'flex', 'flex-direction': 'column', gap: '8px', padding: '0px 14px' });

const columns = styles('columns', {
  display: 'grid',
  'grid-template-columns': '54px 1fr auto',
  gap: '10px',
  padding: '6px 0px',
  'border-bottom': '1px solid var(--edge)'
});

const rows = styles('rows', {
  display: 'flex',
  'flex-direction': 'column',
  margin: '0px',
  padding: '0px 0px 6px',
  'list-style-type': 'none',
  'overflow-x': 'hidden',
  'overflow-y': 'auto',
  'min-height': '0px',
  flex: '1'
});

const rowItem = styles('rowItem', { display: 'block' });

const contactRow = styles('contactRow', {
  css: {
    ...BUTTON_RESET,
    width: '100%',
    display: 'grid',
    'grid-template-columns': '54px 1fr auto',
    'align-items': 'center',
    gap: '10px',
    padding: '7px 14px',
    border: '0px solid transparent',
    'border-left': '2px solid transparent',
    'border-bottom': '1px solid var(--edge-soft)',
    color: 'var(--ink)',
    transition: 'background-color 120ms linear'
  },
  states: {
    hover: { 'background-color': 'var(--cell)' },
    'focus-visible': { outline: '1px solid var(--trace)', 'outline-offset': '-1px' }
  },
  variants: {
    locked: {
      'background-color': 'var(--cell)',
      'border-left-color': 'var(--trace)',
      'box-shadow': 'inset 0 0 24px -12px var(--trace-glow)'
    }
  }
});

const rowMagnitude = styles('rowMagnitude', {
  css: {
    'font-family': 'var(--display)',
    'font-size': '17px',
    'font-weight': '700',
    'line-height': '1',
    color: 'var(--deep)',
    'font-variant-numeric': 'tabular-nums'
  },
  variants: {
    shallow: { color: 'var(--shallow)' },
    intermediate: { color: 'var(--intermediate)' },
    deep: { color: 'var(--deep)' }
  }
});

const rowMain = styles('rowMain', { display: 'flex', 'flex-direction': 'column', gap: '3px', 'min-width': '0px' });

const rowRegion = styles('rowRegion', {
  'font-family': 'var(--mono)',
  'font-size': '11.5px',
  color: 'var(--ink)',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap'
});

const rowMeta = styles('rowMeta', {
  'font-family': 'var(--mono)',
  'font-size': '9.5px',
  'letter-spacing': '0.1em',
  color: 'var(--dim)',
  'font-variant-numeric': 'tabular-nums',
  'white-space': 'nowrap'
});

const rowSide = styles('rowSide', {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'flex-end',
  gap: '4px'
});

const tag = styles('tag', {
  css: {
    padding: '1px 5px',
    'font-family': 'var(--mono)',
    'font-size': '8.5px',
    'font-weight': '700',
    'letter-spacing': '0.16em',
    color: 'var(--void)',
    'background-color': 'var(--trace)'
  },
  variants: { alarm: { 'background-color': 'var(--shallow)' } }
});

const emptyNotice = styles('emptyNotice', {
  padding: '18px 14px',
  'font-family': 'var(--mono)',
  'font-size': '10px',
  'letter-spacing': '0.18em',
  'text-transform': 'uppercase',
  'line-height': '1.6',
  color: 'var(--dim)'
});

const row = (): ElementSpec =>
  container({
    subType: 'li',
    class: rowItem,
    children: [
      button({
        content: '',
        class: contactRow,
        bind: [
          bindTemplate('title', 'contacts.item.place', 'Lock the map on {{ source }}'),
          variantFrom(contactRow, 'state.selectedId', {
            template: "{{ source == list_contacts.item.id ? 'locked' : '' }}"
          })
        ],
        flows: [[onClick(), setState({ key: 'selectedId', type: 'text', value: '{{ list_contacts.item.id }}' })]],
        children: [
          text({
            content: '',
            class: rowMagnitude,
            bind: [
              { to: 'content', source: 'contacts.item.magnitudeLabel' },
              variantFrom(rowMagnitude, 'contacts.item.band')
            ]
          }),
          container({
            class: rowMain,
            children: [
              text({ content: '', class: rowRegion, bind: { content: 'contacts.item.region' } }),
              text({
                content: '',
                class: rowMeta,
                bind: [
                  bindTemplate(
                    'content',
                    'contacts.item',
                    "{{ source.time|date('d M H:i', 'UTC')|upper }} UTC · {{ source.depthLabel }}"
                  )
                ]
              })
            ]
          }),
          container({
            class: rowSide,
            children: [
              text({ content: '', class: rowMeta, bind: { content: 'contacts.item.ageLabel' } }),
              text({ content: 'NEW', class: tag, visible: 'contacts.item.isFresh' }),
              text({ content: 'TSUNAMI', class: tag, variant: 'alarm', visible: 'contacts.item.tsunami' })
            ]
          })
        ]
      })
    ]
  });

export const log = (): ElementSpec =>
  container({
    id: 'log',
    class: logPanel,
    children: [
      container({
        class: logHead,
        children: [
          heading(
            'Contact log',
            text({
              id: 'log-count',
              content: '',
              class: caption,
              bind: [bindTemplate('content', 'feed.records', `{{ (${matching})|length }} contacts`)]
            })
          ),
          container({
            class: logTools,
            children: [
              formControl({
                id: 'log-search',
                name: 'search',
                label: '',
                placeholder: 'Search a place — Tonga, Alaska…',
                required: false,
                autoComplete: false,
                class: logSearch,
                bind: { defaultValue: 'state.search' },
                // A control outside a form keeps its own value and reports every keystroke: the filter is live.
                flows: [
                  [
                    named('typed', on('onChange')),
                    setState({ key: 'search', type: 'text', value: '{{ typed.value }}' })
                  ]
                ]
              }),
              container({
                id: 'log-sort',
                class: segmented,
                children: [
                  chipButton({
                    id: 'sort-newest',
                    content: 'NEW',
                    hint: 'Newest first',
                    source: 'computed.sort',
                    on: "source == 'newest'",
                    flow: [onClick(), setState({ key: 'sort', type: 'text', value: 'newest' })]
                  }),
                  chipButton({
                    id: 'sort-strongest',
                    content: 'MAX',
                    hint: 'Strongest first',
                    source: 'computed.sort',
                    on: "source == 'strongest'",
                    flow: [onClick(), setState({ key: 'sort', type: 'text', value: 'strongest' })]
                  })
                ]
              })
            ]
          }),
          container({
            class: columns,
            children: [
              text({ content: 'Mag', class: caption }),
              text({ content: 'Region', class: caption }),
              text({ content: 'Age', class: caption })
            ]
          })
        ]
      }),
      list({
        id: 'contacts',
        source: 'controlled',
        class: rows,
        bind: [bindTemplate('items', 'feed.records', rowsShown, { returns: 'value' })],
        children: [row()]
      }),
      // "Arrived and empty" — never "not arrived yet": the provider is server-resolved, so the records are always there.
      text({
        id: 'log-empty',
        content: 'Nothing passes these filters in this window. Lower the floor, widen the window or clear the search.',
        class: emptyNotice,
        visible: {
          source: 'feed.records',
          template: `{{ source is defined and (${matching})|length == 0 ? 'true' : 'false' }}`
        }
      })
    ]
  });
