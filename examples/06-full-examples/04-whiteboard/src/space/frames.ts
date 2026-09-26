import {
  bindTemplate,
  button,
  container,
  list,
  onClick,
  setState,
  styles,
  text,
  toggleState,
  variantFrom
} from '@plitzi/sdk-authoring';

import { BUTTON_RESET, FLOAT, caption, icon, iconAction, iconButton } from './kit.ts';
import { closeOthers } from './panels.ts';
import { boardAction } from './stylePanel.ts';

import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * The board's frames, as a way around it: listed in the order they are gone through, each a click away — and the same
 * order, one at a time, as a presentation everyone on the board is shown.
 *
 * The list is the canvas's `onFramesChange`, kept in the page's state; going to one is its `goToFrame`. Presenting is
 * its `present`: each step is told to the room, and every page on the board eases to the frame and says who is
 * presenting and where they are (`onPresentationChange`).
 */

const panel = styles('framesPanel', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      bottom: '66px',
      left: '14px',
      'z-index': '6',
      display: 'flex',
      'flex-direction': 'column',
      gap: '10px',
      width: '272px',
      'max-height': 'min(420px, calc(100dvh - 160px))',
      padding: '14px'
    },
    mobile: { display: 'none' }
  }
});

const head = styles('framesHead', { display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' });

const title = styles('framesTitle', { 'font-size': '14px', 'font-weight': '600' });

const presentButton = styles('presentButton', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    'align-items': 'center',
    gap: '6px',
    height: '30px',
    padding: '0px 12px',
    'border-radius': '8px',
    'font-weight': '600',
    'font-size': '12px',
    'background-color': 'var(--accent)',
    color: 'var(--on-accent)'
  },
  states: {
    hover: { filter: 'brightness(1.08)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
  }
});

const rows = styles('frameRows', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
  margin: '0px',
  padding: '0px',
  'overflow-y': 'auto',
  'list-style-type': 'none'
});

const row = styles('frameRow', {
  css: {
    ...BUTTON_RESET,
    display: 'flex',
    'align-items': 'center',
    gap: '10px',
    width: '100%',
    height: '36px',
    padding: '0px 10px',
    'border-radius': '8px',
    'text-align': 'left',
    'font-size': '13px'
  },
  states: { hover: { 'background-color': 'var(--surface-2)' } }
});

const rowNumber = styles('frameNumber', {
  'min-width': '18px',
  'font-size': '11px',
  'font-weight': '700',
  color: 'var(--muted)',
  'font-variant-numeric': 'tabular-nums'
});

const rowTitle = styles('frameName', {
  flex: '1',
  'min-width': '0px',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
  'font-weight': '500'
});

const rowCount = styles('frameCount', { 'font-size': '11px', color: 'var(--muted)' });

const empty = styles('framesEmpty', { 'font-size': '13px', color: 'var(--muted)', 'line-height': '1.5' });

/** The button in the corner that opens the list. */
export const framesButton = (): ElementSpec =>
  iconAction({
    id: 'frames-open',
    icon: 'fa-regular fa-rectangle-list',
    title: 'Frames — go to one, or present them',
    flow: [onClick(), ...closeOthers('framesOpen'), toggleState({ key: 'framesOpen' })]
  });

/** The minimap, on or off — kept across visits, like any choice of how to see the board. */
export const minimapButton = (): ElementSpec =>
  button({
    id: 'minimap-toggle',
    content: '',
    title: 'Minimap — the whole board, and where everyone is',
    class: iconButton,
    bind: [variantFrom(iconButton, 'computed.minimap', { template: "{{ source ? 'active' : '' }}" })],
    flows: [[onClick(), setState({ key: 'minimap', type: 'boolean', value: '{{ not computed.minimap }}' })]],
    children: [icon('fa-regular fa-map')]
  });

export const framesPanel = (): ElementSpec =>
  container({
    id: 'frames-panel',
    class: panel,
    visible: 'computed.framesOpen',
    children: [
      container({
        class: head,
        children: [
          text({ content: 'Frames', class: title }),
          container({
            visible: 'computed.hasFrames',
            children: [
              button({
                id: 'present',
                content: 'Present',
                title: 'Show the frames one at a time — everyone on the board follows',
                class: presentButton,
                flows: [
                  [onClick(), setState({ key: 'framesOpen', type: 'boolean', value: false }), boardAction('present')]
                ],
                children: [icon('fa-solid fa-play')]
              })
            ]
          })
        ]
      }),
      text({
        content: 'No frames yet. Draw one with the frame tool (F) around a part of the board — or make it a column.',
        class: empty,
        visible: '!computed.hasFrames'
      }),
      list({
        id: 'frames',
        source: 'controlled',
        class: rows,
        bind: [bindTemplate('items', 'computed.frames', '{{ source }}', { returns: 'value' })],
        children: [
          container({
            subType: 'li',
            children: [
              button({
                content: '',
                class: row,
                flows: [[onClick(), boardAction('goToFrame', { id: '{{ list_frames.item.id }}' })]],
                children: [
                  text({
                    content: '',
                    class: rowNumber,
                    bind: [bindTemplate('content', 'frames.index', '{{ source + 1 }}')]
                  }),
                  text({ content: '', class: rowTitle, bind: { content: 'frames.item.title' } }),
                  text({ content: '', class: rowCount, bind: { content: 'frames.item.count' } })
                ]
              })
            ]
          })
        ]
      }),
      text({ content: '← → go through them while presenting · Esc stops', class: caption })
    ]
  });

const banner = styles('presentBanner', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      bottom: '76px',
      left: '50%',
      transform: 'translateX(-50%)',
      'z-index': '4',
      display: 'flex',
      'align-items': 'center',
      gap: '6px',
      padding: '5px 5px 5px 14px',
      'font-size': '13px',
      'font-weight': '600',
      'white-space': 'nowrap',
      border: '1px solid var(--accent)'
    },
    mobile: { bottom: '70px', 'max-width': 'calc(100vw - 24px)' }
  }
});

const bannerStep = styles('presentStep', {
  'max-width': '320px',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  color: 'var(--muted)',
  'font-weight': '500'
});

const bannerWho = styles('presentWho', { color: 'var(--accent)' });

const stopButton = styles('presentStop', {
  css: {
    ...BUTTON_RESET,
    height: '28px',
    padding: '0px 12px',
    'border-radius': '6px',
    'font-size': '12px',
    'font-weight': '600',
    'background-color': 'var(--accent)',
    color: 'var(--on-accent)'
  },
  states: { hover: { filter: 'brightness(1.08)' } }
});

/**
 * While a presentation runs: for whoever gives it, where they are and the way through — back, next, stop; for everyone
 * else, who is presenting and where they are, since their view is being moved for them.
 */
export const presentationBanner = (): ElementSpec =>
  container({
    id: 'presentation',
    class: banner,
    visible: 'computed.presenter',
    children: [
      icon('fa-solid fa-display'),
      text({
        content: '',
        class: bannerWho,
        bind: [
          bindTemplate(
            'content',
            'computed.presenter',
            "{{ source == 'You' ? 'Presenting' : source ~ ' is presenting' }}"
          )
        ]
      }),
      text({ content: '', class: bannerStep, bind: { content: 'computed.presentationStep' } }),
      container({
        visible: 'computed.presentingMine',
        class: styles('presentControls', { display: 'flex', gap: '2px', 'align-items': 'center' }),
        children: [
          iconAction({
            id: 'present-back',
            icon: 'fa-solid fa-chevron-left',
            title: 'Previous frame — ←',
            flow: [onClick(), boardAction('step', { direction: 'left' })]
          }),
          iconAction({
            id: 'present-next',
            icon: 'fa-solid fa-chevron-right',
            title: 'Next frame — →',
            flow: [onClick(), boardAction('step', { direction: 'right' })]
          }),
          button({
            id: 'present-stop',
            content: 'Stop',
            class: stopButton,
            flows: [[onClick(), boardAction('stopPresenting')]]
          })
        ]
      })
    ]
  });
