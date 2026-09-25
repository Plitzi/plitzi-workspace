import {
  bindTemplate,
  button,
  container,
  declaredCallback,
  declaredTrigger,
  defineElement,
  named,
  onClick,
  setState,
  styles,
  text,
  themeToggle,
  toggleState,
  variantFrom,
  when,
  whileRunning
} from '@plitzi/sdk-authoring';

import { ALERTS, REFRESH } from '../filters.ts';
import fullscreenDeclaration from '../plugins/FullscreenToggle/declaration.ts';
import notifierDeclaration from '../plugins/Notifier/declaration.ts';
import { FULLSCREEN_ID, NOTIFIER_ID } from './ids.ts';
import { resetMapView } from './map.ts';
import { nav } from './nav.ts';
import {
  BUTTON_RESET,
  PANEL,
  caption,
  chip,
  heading,
  segmented,
  chipButton,
  sectionContent,
  sectionHeader
} from './kit.ts';

import type { FullscreenToggleAttributes } from '../plugins/FullscreenToggle/declaration.ts';
import type { NotifierAttributes } from '../plugins/Notifier/declaration.ts';
import type { ElementSpec } from '@plitzi/sdk-authoring';

/** Full screen, authored from the plugin's declaration like the map — see why it is an element in its declaration. */
const fullscreenToggle = defineElement<FullscreenToggleAttributes>(fullscreenDeclaration);

export const FULLSCREEN_DECLARATION = fullscreenDeclaration;

/** The display's voice — see the plugin's declaration for why it is an element. */
const notifier = defineElement<NotifierAttributes>(notifierDeclaration);

export const NOTIFIER_DECLARATION = notifierDeclaration;

/**
 * SETTINGS: how the display draws, and how it behaves while it is open — in the corner a reader looks for them.
 *
 * Every switch writes `state` and nothing else; the map reads it through `computed`. Not one of them is a feature of
 * the map element — the map is told what to show, and these are ordinary buttons a space author could move, restyle
 * or drop without touching the plugin. Each row names what it sets in a column of its own, so the panel reads as a
 * table: the eye finds the row, then the position.
 */

/**
 * The panel opens beside the gear, over the globe, and closes on a click anywhere else (the backdrop below). Anchored to
 * the dock rather than placed in the grid, so opening it moves nothing: the log keeps its height, the globe its size.
 */
const settingsPanel = styles('controlPanel', {
  css: {
    desktop: {
      ...PANEL,
      position: 'absolute',
      top: 'calc(100% + 10px)',
      right: '0px',
      width: '360px',
      gap: '8px',
      'background-color': 'var(--panel-strong)',
      border: '1px solid var(--trace)',
      'box-shadow': '0 24px 60px -24px var(--trace-glow)'
    },
    mobile: { width: 'min(360px, calc(100vw - 20px))', padding: '10px 12px' }
  }
});

/** Behind an open panel, over everything else: a click anywhere outside the panel lands here and closes it. */
const backdrop = styles('settingsBackdrop', {
  position: 'absolute',
  inset: '0px',
  'z-index': '6',
  'pointer-events': 'auto',
  'background-color': 'transparent'
});

/** The camera controls, in the display's bottom-right corner under the log. */
const dockClass = styles('dock', {
  css: {
    desktop: { 'grid-area': 'dock', 'justify-self': 'end', 'align-self': 'end', 'pointer-events': 'auto' },
    mobile: { display: 'none' }
  }
});

/**
 * The display's own buttons — full screen and the gear — in its top-right corner, over the end of the command bar — a grid item of its own rather than a
 * child of the bar, so it can sit above the backdrop an open panel spreads without lifting the whole bar with it: a
 * click on a filter while the panel is open lands on the backdrop and closes it, like a click anywhere else.
 */
const settingsCornerClass = styles('settingsCorner', {
  css: {
    desktop: {
      position: 'relative',
      'grid-area': 'bar',
      display: 'flex',
      gap: '8px',
      'justify-self': 'end',
      'align-self': 'center',
      'margin-right': '12px',
      'z-index': '7',
      'pointer-events': 'auto'
    },
    compact: { 'align-self': 'start', 'margin-top': '8px', 'margin-right': '8px' }
  }
});

/** The frame both corner buttons share: an icon in a square, lit on hover. The gear's `open` is the panel showing. */
const cornerButton = styles('cornerButton', {
  css: {
    ...BUTTON_RESET,
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '34px',
    height: '34px',
    padding: '0px',
    border: '1px solid var(--edge)',
    'background-color': 'transparent',
    color: 'var(--trace)',
    transition: 'border-color 140ms linear, box-shadow 140ms linear, background-color 140ms linear'
  },
  states: {
    hover: { 'border-color': 'var(--trace)', 'box-shadow': '0 0 24px -10px var(--trace-glow)' },
    'focus-visible': { outline: '1px solid var(--trace)', 'outline-offset': '2px' }
  },
  variants: { open: { 'background-color': 'var(--trace)', color: 'var(--void)', 'border-color': 'var(--trace)' } }
});

/** The gear itself: a mask over `currentColor`, so it is drawn in whatever colour the button is. Its shape is in `css.ts`. */
const gearIcon = styles('gearIcon', {
  width: '20px',
  height: '20px',
  'flex-shrink': '0',
  'background-color': 'currentColor'
});

const settingRow = styles('settingRow', {
  display: 'grid',
  'grid-template-columns': '62px minmax(0px, 1fr)',
  'align-items': 'center',
  gap: '10px'
});

/** Chips on a row may wrap, and a pair of switches (view and theme) share one. */
const settingChips = styles('settingChips', {
  display: 'flex',
  'flex-wrap': 'wrap',
  'align-items': 'center',
  gap: '6px 10px'
});

/** A hairline between what the display DRAWS and how it BEHAVES while open. */
const settingDivider = styles('settingDivider', {
  height: '1px',
  margin: '2px 0px',
  'background-color': 'var(--edge-soft)'
});

/** The replay button: the display's one big action, so it is the one full-width control and lights while running. */
const replayButton = styles('replayButton', {
  css: {
    ...BUTTON_RESET,
    width: '100%',
    'min-height': '34px',
    'margin-top': '2px',
    padding: '0px 14px',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    gap: '10px',
    border: '1px solid var(--trace)',
    'background-color': 'var(--cell)',
    color: 'var(--trace)',
    'font-family': 'var(--mono)',
    'font-size': '11px',
    'font-weight': '700',
    'letter-spacing': '0.22em',
    transition: 'background-color 140ms linear, box-shadow 140ms linear'
  },
  states: {
    hover: { 'box-shadow': '0 0 26px -10px var(--trace-glow)', 'background-color': 'var(--edge-soft)' },
    'focus-visible': { outline: '1px solid var(--trace)', 'outline-offset': '2px' }
  },
  variants: { running: { 'background-color': 'var(--trace)', color: 'var(--void)' } }
});

const themeSwitch = styles('themeSwitch', {
  'font-family': 'var(--mono)',
  'font-size': '10px',
  'letter-spacing': '0.14em',
  'text-transform': 'uppercase'
});

/** Replay and tour, side by side: the two ways the display runs by itself. Starting one stops the other. */
const runButtons = styles('runButtons', {
  display: 'grid',
  'grid-template-columns': 'repeat(2, minmax(0, 1fr))',
  gap: '8px'
});

const keysLink = styles('keysLink', {
  css: {
    ...BUTTON_RESET,
    'align-self': 'flex-start',
    padding: '2px 0px',
    border: '0px solid transparent',
    'background-color': 'transparent',
    'font-family': 'var(--mono)',
    'font-size': '10px',
    'letter-spacing': '0.14em',
    'text-transform': 'uppercase',
    color: 'var(--dim)'
  },
  states: {
    hover: { color: 'var(--trace)' },
    'focus-visible': { outline: '1px solid var(--trace)', 'outline-offset': '2px' }
  }
});

/** How far away the display is read from. The scale itself is in `css.ts`. */
const SIZES = [
  { key: 'desk', label: 'DESK', hint: 'Native size, for a monitor at arm’s length' },
  { key: 'wall', label: 'WALL', hint: 'Larger, for a wall screen across a desk' },
  { key: 'tv', label: 'TV', hint: 'Largest, for a TV or a projector across a room' }
] as const;

/** A switch whose state key names the way it leaves its default, read back through `computed`. */
const toggle = (
  id: string,
  content: string,
  hint: string,
  key: string,
  reads: string,
  unavailable?: { source: string; when: string; hint: string }
): ElementSpec =>
  chipButton({
    id,
    content,
    hint,
    source: reads,
    on: 'source',
    flow: [onClick(), toggleState({ key })],
    ...(unavailable ? { unavailable } : {})
  });

const row = (name: string, id: string, chips: ElementSpec[]): ElementSpec =>
  container({
    class: settingRow,
    children: [text({ content: name, class: caption }), container({ id, class: settingChips, children: chips })]
  });

const choice = (id: string, chips: ElementSpec[]): ElementSpec => container({ id, class: segmented, children: chips });

const settingsPanelElement = (): ElementSpec =>
  container({
    id: 'controls',
    class: settingsPanel,
    visible: 'computed.settingsOpen',
    children: [
      heading('Settings', text({ content: 'Kept on this screen', class: caption })),
      row('View', 'view-settings', [
        choice('projection-switch', [
          chipButton({
            id: 'projection-globe',
            content: 'GLOBE',
            hint: 'Orthographic globe',
            source: 'computed.projection',
            on: "source == 'globe'",
            flow: [onClick(), setState({ key: 'projection', type: 'text', value: 'globe' })]
          }),
          chipButton({
            id: 'projection-flat',
            content: 'FLAT',
            hint: 'Web Mercator',
            source: 'computed.projection',
            on: "source == 'flat'",
            flow: [onClick(), setState({ key: 'projection', type: 'text', value: 'flat' })]
          })
        ]),
        // AUTO is the third position, and the one a visit starts on: it follows the machine, so there is always an
        // option lit — a switch with nothing chosen reads as broken, however correct the colours are.
        themeToggle({
          id: 'theme',
          subType: 'segmented',
          showSystem: true,
          systemLabel: 'Auto',
          darkLabel: 'Night',
          lightLabel: 'Day',
          class: themeSwitch,
          slots: { option: chip }
        })
      ]),
      row('Size', 'size-settings', [
        choice(
          'size-switch',
          SIZES.map(size =>
            chipButton({
              id: `size-${size.key}`,
              content: size.label,
              hint: size.hint,
              source: 'computed.size',
              on: `source == '${size.key}'`,
              flow: [onClick(), setState({ key: 'size', type: 'text', value: size.key })]
            })
          )
        )
      ]),
      row('Layers', 'layer-settings', [
        choice('layer-switches', [
          toggle('layer-plates', 'PLATES', 'Tectonic plate boundaries', 'platesOff', 'computed.plates'),
          toggle('layer-density', 'DENSITY', 'Where the energy concentrates', 'densityOn', 'computed.density'),
          toggle('layer-rotate', 'ROTATE', 'Turn the globe while idle', 'spinOff', 'computed.rotate', {
            source: 'computed.projection',
            when: "source == 'flat'",
            hint: 'Only the globe turns: switch to GLOBE to rotate'
          })
        ])
      ]),
      container({ class: settingDivider }),
      row('Refresh', 'refresh-settings', [
        choice(
          'refresh-switch',
          REFRESH.map(option =>
            chipButton({
              id: `refresh-${option.seconds}`,
              content: option.label,
              hint: option.seconds
                ? `Ask the server every ${option.seconds} seconds — the USGS itself publishes once a minute`
                : 'Hold the display still',
              source: 'computed.refresh',
              on: `source == ${option.seconds}`,
              flow: [onClick(), setState({ key: 'refresh', type: 'number', value: option.seconds })]
            })
          )
        )
      ]),
      row('Alert', 'alert-settings', [
        choice(
          'alert-switch',
          ALERTS.map(option =>
            chipButton({
              id: `alert-${option.key}`,
              content: option.label,
              hint:
                option.key === 'off'
                  ? 'Never announce a new event'
                  : `Announce new events of magnitude ${option.min}+, whatever the display filters show`,
              source: 'computed.alert',
              on: `source == '${option.key}'`,
              flow: [onClick(), setState({ key: 'alert', type: 'text', value: option.key })]
            })
          )
        )
      ]),
      row('Follow', 'follow-settings', [
        chipButton({
          id: 'live-follow',
          content: 'FLY TO NEW EVENTS',
          hint: 'Lock the map on every event that crosses the alert threshold, exactly as a click would',
          source: 'computed.follow',
          on: 'source',
          flow: [onClick(), toggleState({ key: 'followOff' })]
        })
      ]),
      row('Sound', 'sound-settings', [
        choice('sound-switch', [
          chipButton({
            id: 'sound',
            content: 'SOUND',
            hint: 'Heard on every new event: a ping on the page, and the sound of the desktop alert  (M)',
            source: 'computed.sound',
            on: 'source',
            flow: [onClick(), toggleState({ key: 'soundOff' })]
          }),
          chipButton({
            id: 'sound-test',
            content: '▶ TEST',
            hint: 'Play the alert of a strong event, as it will sound',
            source: 'computed.sound',
            on: 'false',
            flow: [
              onClick(),
              when(
                { field: 'state.soundOff', operator: '!=', value: true },
                declaredCallback(notifierDeclaration, 'chime', { on: NOTIFIER_ID, params: { magnitude: '6' } })
              ),
              declaredCallback(notifierDeclaration, 'notify', {
                on: NOTIFIER_ID,
                params: {
                  title: 'M6.0 · TEST ALERT',
                  body: 'This is how a new event is announced.',
                  silent: "{{ state.soundOff ? 'true' : 'false' }}",
                  tag: 'tremor-test'
                }
              })
            ]
          })
        ])
      ]),
      row('Alerts', 'alert-desktop', [
        notifier({
          id: NOTIFIER_ID,
          class: chip,
          enableLabel: 'ENABLE DESKTOP ALERTS',
          onLabel: 'DESKTOP ALERTS ON',
          blockedLabel: 'BLOCKED BY THE BROWSER',
          bind: [variantFrom(chip, 'state.alertsPermission', { template: "{{ source == 'granted' ? 'on' : '' }}" })],
          flows: [
            [
              // Queued: the notifier reports twice as it mounts — unknown, then what the browser says — and the last
              // report is the one that must stick, not the first one still running.
              whileRunning('queue', named('permission', declaredTrigger(notifierDeclaration, 'onPermission'))),
              setState({ key: 'alertsPermission', type: 'text', value: '{{ permission.permission }}' })
            ]
          ]
        })
      ]),
      row('Tour', 'tour-settings', [
        chipButton({
          id: 'auto-tour',
          content: 'AUTO WHEN IDLE',
          hint: 'After two minutes with nobody at the screen, tour the strongest events — for a display left on a wall',
          source: 'computed.idleSeconds',
          on: 'source > 0',
          flow: [onClick(), toggleState({ key: 'autoTour' })]
        })
      ]),
      container({
        class: runButtons,
        children: [
          button({
            id: 'replay',
            content: '',
            title: 'Replay the window from its first event to its last  (R)',
            class: replayButton,
            bind: [
              bindTemplate('content', 'computed.replaying', "{{ source ? '■  STOP REPLAY' : '▶  REPLAY' }}"),
              bindTemplate('ariaPressed', 'computed.replaying', "{{ source ? 'true' : 'false' }}"),
              variantFrom(replayButton, 'computed.replaying', { template: "{{ source ? 'running' : '' }}" })
            ],
            // A replay is watched from the whole view: the lock is released and the camera pulled back before it starts.
            flows: [
              [
                onClick(),
                setState({ key: 'tour', type: 'boolean', value: false }),
                setState({ key: 'selectedId', type: 'text', value: '' }),
                resetMapView(),
                toggleState({ key: 'replay' })
              ]
            ]
          }),
          button({
            id: 'tour',
            content: '',
            title: 'Visit the strongest events of the window, one after another  (T)',
            class: replayButton,
            bind: [
              bindTemplate('content', 'computed.touring', "{{ source ? '■  STOP TOUR' : '◎  TOUR' }}"),
              bindTemplate('ariaPressed', 'computed.touring', "{{ source ? 'true' : 'false' }}"),
              variantFrom(replayButton, 'computed.touring', { template: "{{ source ? 'running' : '' }}" })
            ],
            flows: [
              [onClick(), setState({ key: 'replay', type: 'boolean', value: false }), toggleState({ key: 'tour' })]
            ]
          })
        ]
      }),
      button({
        id: 'keys-open',
        content: '?  Keyboard shortcuts',
        title: 'Every key the display answers to  (?)',
        class: keysLink,
        flows: [
          [
            onClick(),
            setState({ key: 'settingsOpen', type: 'boolean', value: false }),
            setState({ key: 'keysOpen', type: 'boolean', value: true })
          ]
        ]
      })
    ]
  });

const closeSettings = setState({ key: 'settingsOpen', type: 'boolean', value: false });

/** Everything behind an open settings panel. Present only while it is open, so the globe is otherwise untouched. */
export const settingsBackdrop = (): ElementSpec =>
  container({
    id: 'settings-backdrop',
    class: backdrop,
    visible: 'computed.settingsOpen',
    flows: [[onClick(), closeSettings]]
  });

/** The camera, in the bottom-right corner. */
export const dock = (): ElementSpec => container({ id: 'dock', class: dockClass, children: [nav()] });

/**
 * SETTINGS: the gear that opens it, and the panel that drops below it.
 *
 * The gear is a button like any other: it flips `settingsOpen`, the panel shows while that is true, and the backdrop
 * behind it closes it on a click anywhere else. No popup machinery — three elements and one state key.
 */
export const settingsCorner = (): ElementSpec =>
  container({
    id: 'settings-corner',
    class: settingsCornerClass,
    children: [
      fullscreenToggle({
        id: FULLSCREEN_ID,
        class: cornerButton,
        label: 'Full screen (F)',
        exitLabel: 'Exit full screen (F)'
      }),
      button({
        id: 'settings-toggle',
        content: '',
        title: 'Settings (S)',
        class: cornerButton,
        bind: [
          variantFrom(cornerButton, 'computed.settingsOpen', { template: "{{ source ? 'open' : '' }}" }),
          bindTemplate('ariaExpanded', 'computed.settingsOpen', "{{ source ? 'true' : 'false' }}")
        ],
        flows: [[onClick(), toggleState({ key: 'settingsOpen' })]],
        // An icon alone: its name is the button's title and aria label, which is what a screen reader announces.
        children: [text({ content: '', class: gearIcon })]
      }),
      settingsPanelElement()
    ]
  });

// ── The legend ─────────────────────────────────────────────────────────────────────────────────────────────────────

const legendPanel = styles('legendPanel', { ...PANEL, gap: '10px', 'align-self': 'end' });

const legendColumns = styles('legendColumns', {
  display: 'grid',
  'grid-template-columns': 'minmax(0px, 1fr) minmax(0px, 1fr)',
  gap: '10px 14px'
});

const legendRow = styles('legendRow', {
  display: 'flex',
  'align-items': 'center',
  gap: '10px',
  'font-family': 'var(--mono)',
  'font-size': '10px',
  'letter-spacing': '0.08em',
  color: 'var(--ink)'
});

const legendGroup = styles('legendGroup', { display: 'flex', 'flex-direction': 'column', gap: '6px' });

/** A dot per depth band, from the same token the map paints that band with. */
const dot = styles('dot', {
  css: {
    width: '10px',
    height: '10px',
    'border-radius': '999px',
    'flex-shrink': '0',
    'background-color': 'var(--deep)'
  },
  variants: {
    shallow: { 'background-color': 'var(--shallow)', 'box-shadow': '0 0 8px var(--shallow)' },
    intermediate: { 'background-color': 'var(--intermediate)', 'box-shadow': '0 0 8px var(--intermediate)' },
    deep: { 'background-color': 'var(--deep)', 'box-shadow': '0 0 8px var(--deep)' }
  }
});

const sizes = styles('sizes', { display: 'flex', 'align-items': 'flex-end', gap: '14px' });

const sizeMark = styles('sizeMark', {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '4px'
});

/** The magnitude scale, drawn at the radii the map uses at its opening zoom. */
const ring = styles('ring', {
  css: { 'border-radius': '999px', border: '1px solid var(--ink)', opacity: '0.8' },
  variants: {
    m3: { width: '6px', height: '6px' },
    m5: { width: '12px', height: '12px' },
    m7: { width: '26px', height: '26px' }
  }
});

/** The three plate-boundary strokes, as the map draws them: a solid line, a double one, a row of dots. */
const stroke = styles('stroke', {
  css: { width: '26px', height: '0px', 'flex-shrink': '0', 'border-top': '2px solid var(--plate)' },
  variants: {
    divergent: { height: '3px', 'border-bottom': '1px solid var(--plate)', 'border-top-width': '1px' },
    transform: { 'border-top-style': 'dotted' }
  }
});

const pulse = styles('pulse', {
  width: '10px',
  height: '10px',
  'border-radius': '999px',
  border: '1px solid var(--trace)',
  'flex-shrink': '0'
});

const credits = styles('credits', {
  'padding-top': '8px',
  'border-top': '1px solid var(--edge-soft)',
  'font-family': 'var(--mono)',
  'font-size': '8.5px',
  'letter-spacing': '0.1em',
  'line-height': '1.6',
  color: 'var(--dim)'
});

const DEPTHS = [
  { band: 'shallow', text: 'Shallow <70 km' },
  { band: 'intermediate', text: 'Mid 70–300 km' },
  { band: 'deep', text: 'Deep >300 km' }
] as const;

const PLATES = [
  { kind: '', text: 'Convergent' },
  { kind: 'divergent', text: 'Divergent' },
  { kind: 'transform', text: 'Transform' }
] as const;

export const legend = (): ElementSpec =>
  container({
    id: 'legend',
    class: legendPanel,
    children: [
      sectionHeader('legend', 'Legend'),
      sectionContent('legend', [
        container({
          class: legendColumns,
          children: [
            container({
              class: legendGroup,
              children: [
                text({ content: 'Focal depth', class: caption }),
                ...DEPTHS.map(entry =>
                  container({
                    class: legendRow,
                    children: [text({ content: '', class: dot, variant: entry.band }), text(entry.text)]
                  })
                )
              ]
            }),
            container({
              id: 'legend-plates',
              class: legendGroup,
              visible: 'computed.plates',
              children: [
                text({ content: 'Plate boundary', class: caption }),
                ...PLATES.map(entry =>
                  container({
                    class: legendRow,
                    children: [
                      text({ content: '', class: stroke, ...(entry.kind ? { variant: entry.kind } : {}) }),
                      text(entry.text)
                    ]
                  })
                )
              ]
            }),
            container({
              class: sizes,
              children: (['m3', 'm5', 'm7'] as const).map(size =>
                container({
                  class: sizeMark,
                  children: [
                    text({ content: '', class: ring, variant: size }),
                    text({ content: size.toUpperCase(), class: caption })
                  ]
                })
              )
            }),
            container({
              class: legendRow,
              children: [text({ content: '', class: pulse }), text('Pulse · last hour')]
            })
          ]
        }),
        text({
          content: 'Events USGS NEIC · coastlines Natural Earth · plates PB2002, Bird 2003 · times UTC',
          class: credits
        })
      ])
    ]
  });
