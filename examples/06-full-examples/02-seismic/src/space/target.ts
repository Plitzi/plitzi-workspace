import {
  bindTemplate,
  button,
  container,
  link,
  list,
  onClick,
  setState,
  styles,
  text,
  variantFrom
} from '@plitzi/sdk-authoring';

import { bandMagnitude } from './board.ts';
import { BUTTON_RESET, PANEL, caption, chip, label } from './kit.ts';

import type { BindingSpec, ElementSpec } from '@plitzi/sdk-authoring';

/**
 * The dossier: everything the feed knows about the locked event.
 *
 * It is a list of at most one — the window's records filtered to the id in `state.selectedId` — which is the detail
 * page recipe, used in place: the fields below read `target.item.*` like any row does, and the panel is simply not
 * there when nothing is locked, or when the locked event has left the window. No second request, and no copy of the
 * event in state that could drift from the feed it came from.
 */

const lockedEvent = '{{ source|filter(q => q.id == state.selectedId)|slice(0, 1) }}';

const targetSlot = styles('targetSlot', {
  css: {
    desktop: {
      margin: '0px',
      padding: '0px',
      'list-style-type': 'none',
      'justify-self': 'center',
      'align-self': 'end',
      width: '100%',
      'max-width': '640px',
      'pointer-events': 'auto'
    },
    compact: { 'max-width': '100%' }
  }
});

const dossier = styles('dossier', {
  ...PANEL,
  'background-color': 'var(--panel-strong)',
  border: '1px solid var(--trace)',
  'box-shadow': '0 0 60px -24px var(--trace-glow)',
  padding: '14px 18px 16px',
  gap: '12px'
});

const dossierHead = styles('dossierHead', {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
  'padding-bottom': '10px',
  'border-bottom': '1px solid var(--edge-soft)'
});

const lockMark = styles('lockMark', {
  'font-family': 'var(--mono)',
  'font-size': '10px',
  'font-weight': '700',
  'letter-spacing': '0.3em',
  color: 'var(--trace)'
});

const eventCode = styles('eventCode', {
  flex: '1',
  'font-family': 'var(--mono)',
  'font-size': '10px',
  'letter-spacing': '0.14em',
  color: 'var(--dim)'
});

const closeButton = styles('closeButton', {
  css: {
    ...BUTTON_RESET,
    width: '28px',
    height: '28px',
    padding: '0px',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    border: '1px solid var(--edge)',
    color: 'var(--dim)',
    'font-family': 'var(--mono)',
    'font-size': '14px',
    'line-height': '1'
  },
  states: {
    hover: { color: 'var(--trace)', 'border-color': 'var(--trace)' },
    'focus-visible': { outline: '1px solid var(--trace)', 'outline-offset': '2px' }
  }
});

const identity = styles('identity', {
  display: 'grid',
  'grid-template-columns': 'auto 1fr',
  'column-gap': '16px',
  'row-gap': '4px',
  'align-items': 'center'
});

const regionName = styles('regionName', {
  'font-family': 'var(--display)',
  'font-size': '22px',
  'font-weight': '600',
  'line-height': '1.1',
  color: 'var(--ink)'
});

const placeLine = styles('placeLine', {
  'font-family': 'var(--mono)',
  'font-size': '11px',
  'letter-spacing': '0.04em',
  color: 'var(--dim)'
});

const facts = styles('facts', {
  css: {
    desktop: {
      display: 'grid',
      'grid-template-columns': 'repeat(4, minmax(0, 1fr))',
      gap: '1px',
      'background-color': 'var(--edge-soft)'
    },
    mobile: { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' }
  }
});

const fact = styles('fact', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
  padding: '8px 10px',
  'min-width': '0px',
  'background-color': 'var(--panel-strong)'
});

const factValue = styles('factValue', {
  css: {
    'font-family': 'var(--mono)',
    'font-size': '12px',
    'font-weight': '500',
    color: 'var(--ink)',
    'white-space': 'nowrap',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    'font-variant-numeric': 'tabular-nums'
  },
  variants: { alarm: { color: 'var(--shallow)', 'font-weight': '700' } }
});

/** The PAGER level, in the USGS's own four colours: the one place on this display a colour is not depth. */
const pagerValue = styles('pagerValue', {
  css: {
    'font-family': 'var(--mono)',
    'font-size': '12px',
    'font-weight': '700',
    'letter-spacing': '0.12em',
    'text-transform': 'uppercase',
    color: 'var(--dim)'
  },
  variants: {
    green: { color: 'var(--pager-green)' },
    yellow: { color: 'var(--pager-yellow)' },
    orange: { color: 'var(--pager-orange)' },
    red: { color: 'var(--pager-red)' }
  }
});

const significance = styles('significance', { display: 'flex', 'align-items': 'center', gap: '12px' });

const gauge = styles('gauge', {
  position: 'relative',
  flex: '1',
  height: '4px',
  'background-color': 'var(--edge-soft)',
  overflow: 'hidden'
});

const gaugeFill = styles('gaugeFill', {
  position: 'absolute',
  top: '0px',
  left: '0px',
  bottom: '0px',
  'background-color': 'var(--trace)',
  'box-shadow': '0 0 10px var(--trace-glow)',
  transition: 'width 400ms ease-out'
});

const gaugeValue = styles('gaugeValue', {
  'min-width': '4ch',
  'text-align': 'right',
  'font-family': 'var(--mono)',
  'font-size': '11px',
  color: 'var(--ink)',
  'font-variant-numeric': 'tabular-nums'
});

const footer = styles('footer', {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  gap: '12px',
  'flex-wrap': 'wrap'
});

const fieldOf = (id: string, name: string, value: BindingSpec[] | string, valueClass = factValue): ElementSpec =>
  container({
    id: `target-${id}`,
    class: fact,
    children: [
      label(name),
      text({
        id: `target-${id}-value`,
        content: '',
        class: valueClass,
        bind: typeof value === 'string' ? { content: value } : value
      })
    ]
  });

const dossierCard = (): ElementSpec =>
  container({
    subType: 'li',
    id: 'dossier',
    class: dossier,
    children: [
      container({
        class: dossierHead,
        children: [
          text({ content: '◉ TARGET LOCK', class: lockMark }),
          text({
            id: 'target-code',
            content: '',
            class: eventCode,
            bind: [
              bindTemplate(
                'content',
                'target.item',
                '{{ source.network }} · {{ source.id|upper }} · {{ source.status|upper }}'
              )
            ]
          }),
          button({
            id: 'target-close',
            content: '✕',
            title: 'Release the lock',
            class: closeButton,
            flows: [[onClick(), setState({ key: 'selectedId', type: 'text', value: '' })]]
          })
        ]
      }),
      container({
        class: identity,
        children: [
          text({
            id: 'target-magnitude',
            content: '',
            class: bandMagnitude,
            bind: [
              { to: 'content', source: 'target.item.magnitudeLabel' },
              variantFrom(bandMagnitude, 'target.item.band')
            ]
          }),
          text({ id: 'target-region', content: '', class: regionName, bind: { content: 'target.item.region' } }),
          text({
            id: 'target-place',
            content: '',
            class: placeLine,
            bind: [bindTemplate('content', 'target.item', '{{ source.place }} · {{ source.magnitudeType|upper }}')]
          })
        ]
      }),
      container({
        class: facts,
        children: [
          fieldOf('time', 'Origin · UTC', [
            bindTemplate('content', 'target.item.time', "{{ source|date('d M · H:i:s', 'UTC')|upper }}")
          ]),
          fieldOf('depth', 'Focal depth', [
            bindTemplate('content', 'target.item', '{{ source.depthLabel }} · {{ source.band|upper }}')
          ]),
          fieldOf('where', 'Epicentre', 'target.item.coordinates'),
          fieldOf('age', 'Before feed', [bindTemplate('content', 'target.item.ageLabel', '{{ source }} ago')]),
          fieldOf(
            'pager',
            'PAGER',
            [
              bindTemplate('content', 'target.item.alert', "{{ source == 'none' ? 'not issued' : source }}"),
              variantFrom(pagerValue, 'target.item.alert')
            ],
            pagerValue
          ),
          fieldOf('tsunami', 'Tsunami', [
            bindTemplate('content', 'target.item.tsunami', "{{ source ? 'FLAGGED' : 'none' }}"),
            variantFrom(factValue, 'target.item.tsunami', { template: "{{ source ? 'alarm' : '' }}" })
          ]),
          fieldOf('felt', 'Felt reports', [
            bindTemplate('content', 'target.item.felt', "{{ source|number_format(0, '.', ',') }}")
          ]),
          fieldOf('intensity', 'Peak intensity', [
            bindTemplate('content', 'target.item.intensity', "{{ source == '—' ? '—' : 'MMI ' ~ source }}")
          ])
        ]
      }),
      container({
        class: significance,
        children: [
          text({ content: 'Significance', class: caption }),
          container({
            class: gauge,
            children: [
              container({
                id: 'target-gauge',
                class: gaugeFill,
                bind: [bindTemplate('width', 'target.item.significancePct', '{{ source }}%', { category: 'style' })]
              })
            ]
          }),
          text({
            id: 'target-significance',
            content: '',
            class: gaugeValue,
            bind: { content: 'target.item.significance' }
          })
        ]
      }),
      container({
        class: footer,
        children: [
          text({ content: 'Rings · 100 / 300 / 1,000 km from the epicentre', class: caption }),
          link({
            id: 'target-usgs',
            mode: 'external',
            target: 'blank',
            label: 'Open the event on the USGS site',
            class: chip,
            bind: { href: 'target.item.url' },
            children: [text('USGS EVENT PAGE ↗')]
          })
        ]
      })
    ]
  });

export const target = (): ElementSpec =>
  list({
    id: 'target',
    source: 'controlled',
    class: targetSlot,
    bind: [bindTemplate('items', 'feed.records', lockedEvent, { returns: 'value' })],
    children: [dossierCard()]
  });
