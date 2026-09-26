import {
  addNotification,
  button,
  container,
  declaredTrigger,
  defineElement,
  named,
  navigate,
  onClick,
  runServerAction,
  styles,
  text,
  variantFrom,
  whenFailed
} from '@plitzi/sdk-authoring';

import { CREATE_ACTION, REACH_ACTION, READ_ONLY_ACTION } from '../actions.ts';
import { BOARD_PASS, IS_OWNER, keepOwned } from './access.ts';
import { BOARD_PROVIDER } from './ids.ts';
import { BUTTON_RESET, caption, icon } from './kit.ts';
import { DEFAULT_LIFETIME } from '../board/model.ts';
import countdownDeclaration from '../plugins/Countdown/declaration.ts';

import type { CountdownAttributes } from '../plugins/Countdown/declaration.ts';
import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * Who may find a board, and how long it lasts.
 *
 * Public boards are listed on the front page; a private one is reached only by whoever has the link. A temporary one
 * — an hour, five, a day — is gone for everyone when its time is up, with everything on it: a quick session that
 * leaves nothing behind. Both are the board's (`board-reach`), said on its channel, and shown on it for everyone.
 */

const countdown = defineElement<CountdownAttributes>(countdownDeclaration);

const PROVIDER = `apiContainer_${BOARD_PROVIDER}`;

const reachWith = (visibility: string, hours: string): StepSpec[] => [
  named(
    'reached',
    runServerAction({
      actionId: REACH_ACTION,
      input: { board: `{{ ${PROVIDER}.id }}`, ...BOARD_PASS, visibility, hours },
      invalidateQueries: 'none'
    })
  ),
  whenFailed(
    'reached',
    addNotification({
      content: '{{ reached.error ? reached.error : "That could not be changed" }}',
      appearance: 'danger',
      placement: 'bottom-center',
      autoDismissTimeout: 5000
    })
  )
];

/** The visibility the board has now, as the choice names it. */
const VISIBILITY = `{{ ${PROVIDER}.unlisted ? 'private' : 'public' }}`;

const row = styles('reachRow', { display: 'flex', gap: '6px' });

const choice = styles('reachChoice', {
  css: {
    ...BUTTON_RESET,
    flex: '1',
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    gap: '6px',
    height: '32px',
    'border-radius': '8px',
    'font-size': '12px',
    'font-weight': '600',
    'background-color': 'var(--surface-2)'
  },
  states: { hover: { 'background-color': 'var(--edge)' }, 'focus-visible': { outline: '2px solid var(--accent)' } },
  variants: { chosen: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

const note = styles('reachNote', { 'font-size': '12px', color: 'var(--muted)', 'line-height': '1.45' });

const left = styles('reachLeft', { 'font-weight': '700', color: 'var(--ink)', 'font-variant-numeric': 'tabular-nums' });

const LIFETIMES: readonly { hours: string; label: string; long: string }[] = [
  { hours: '1', label: '1 h', long: '1 hour' },
  { hours: '5', label: '5 h', long: '5 hours' },
  { hours: '24', label: '1 day', long: '1 day' },
  { hours: '168', label: '1 wk', long: '1 week' },
  { hours: '0', label: 'Ever', long: 'for good' }
];

/** The two choices in the share panel — for whoever may change the board. */
export const reachSection = (): ElementSpec[] => [
  text({ content: 'Who can find it', class: caption }),
  container({
    class: row,
    children: [
      { value: 'public', label: 'Public', glyph: 'fa-solid fa-globe' },
      { value: 'private', label: 'Private', glyph: 'fa-regular fa-eye-slash' }
    ].map(option =>
      button({
        id: `visibility-${option.value}`,
        content: option.label,
        title:
          option.value === 'public' ? 'Listed on the front page for anyone' : 'Only whoever has the link — not listed',
        class: choice,
        bind: [
          variantFrom(choice, BOARD_PROVIDER, {
            template: `{{ (source.unlisted ? 'private' : 'public') == '${option.value}' ? 'chosen' : '' }}`
          })
        ],
        flows: [[onClick(), ...reachWith(option.value, 'keep')]],
        children: [icon(option.glyph)]
      })
    )
  }),
  text({ content: 'How long it lasts', class: caption }),
  container({
    class: row,
    children: LIFETIMES.map(option =>
      button({
        id: `lifetime-${option.hours}`,
        content: option.label,
        title: option.hours === '0' ? 'Keep the board for good' : `Gone for everyone ${option.long} from now`,
        class: choice,
        // Only "for good" can be shown as chosen: a temporary board knows when it ends, not which button began it.
        bind:
          option.hours === '0'
            ? [variantFrom(choice, BOARD_PROVIDER, { template: "{{ source.expiresAt ? '' : 'chosen' }}" })]
            : [],
        flows: [[onClick(), ...reachWith(VISIBILITY, option.hours)]]
      })
    )
  }),
  container({
    class: note,
    visible: { source: BOARD_PROVIDER, template: "{{ source.expiresAt ? 'true' : 'false' }}" },
    children: [
      text({ content: 'Gone for everyone in ' }),
      countdown({
        id: 'reach-left',
        runtime: 'client',
        class: left,
        bind: [{ to: 'endsAt', source: `${BOARD_PROVIDER}.expiresAt` }]
      })
    ]
  })
];

/**
 * Who may change the board — for whoever made it, and nobody else: everyone, or only them. Read-only, the others look
 * around together, point and react, and cannot change a thing; the creator goes on drawing. Everyone on the board is
 * told, by the board's feed.
 */
export const editingSection = (): ElementSpec =>
  container({
    class: styles('editingSection', { display: 'contents' }),
    visible: { source: BOARD_PROVIDER, template: `{{ ${IS_OWNER} ? 'true' : 'false' }}` },
    children: [
      text({ content: 'Who can change it', class: caption }),
      container({
        class: row,
        children: [
          { readOnly: false, label: 'Everyone', glyph: 'fa-solid fa-pen', title: 'Anyone on the board can draw' },
          {
            readOnly: true,
            label: 'Only me',
            glyph: 'fa-regular fa-eye',
            title: 'Read-only for everyone else — they look, point and react'
          }
        ].map(option =>
          button({
            id: `editing-${option.readOnly ? 'owner' : 'everyone'}`,
            content: option.label,
            title: option.title,
            class: choice,
            bind: [
              variantFrom(choice, BOARD_PROVIDER, {
                template: `{{ ${option.readOnly ? '' : 'not '}source.readOnly ? 'chosen' : '' }}`
              })
            ],
            flows: [
              [
                onClick(),
                named(
                  'restricted',
                  runServerAction({
                    actionId: READ_ONLY_ACTION,
                    input: { board: `{{ ${PROVIDER}.id }}`, ...BOARD_PASS, readOnly: String(option.readOnly) },
                    invalidateQueries: 'none'
                  })
                ),
                whenFailed(
                  'restricted',
                  addNotification({
                    content: '{{ restricted.error ? restricted.error : "That could not be changed" }}',
                    appearance: 'danger',
                    placement: 'bottom-center',
                    autoDismissTimeout: 5000
                  })
                )
              ]
            ],
            children: [icon(option.glyph)]
          })
        )
      }),
      text({ content: 'You made this board, so only you can choose.', class: note })
    ]
  });

const BADGE = {
  display: 'inline-flex',
  'align-items': 'center',
  gap: '6px',
  height: '26px',
  padding: '0px 9px',
  'margin-left': '4px',
  'border-radius': '999px',
  'font-size': '12px',
  'font-weight': '600',
  'white-space': 'nowrap',
  'font-variant-numeric': 'tabular-nums'
};

const badge = styles('reachBadge', {
  css: {
    desktop: { ...BADGE, color: 'var(--muted)', 'background-color': 'var(--surface-2)' },
    mobile: { display: 'none' }
  }
});

/** The time a board has left — in `css.ts`, its last hour in the danger colour. */
const boardLeft = styles('boardLeft', { 'font-variant-numeric': 'tabular-nums' });

const temporaryBadge = styles('temporaryBadge', {
  css: {
    desktop: {
      ...BADGE,
      color: 'var(--muted)',
      'background-color': 'var(--surface-2)'
    },
    mobile: { display: 'none' }
  }
});

/**
 * What the board is, beside its title: private, and — temporary — the time it has left, ticking. When it runs out,
 * the board is gone, and so is everyone on it.
 */
export const reachBadges = (): ElementSpec[] => [
  // Behind a password: said beside the title, so whoever is on it knows the link alone does not let anybody in.
  container({
    class: badge,
    visible: { source: BOARD_PROVIDER, template: "{{ source.locked ? 'true' : 'false' }}" },
    children: [icon('fa-solid fa-lock'), text({ content: 'Password' })]
  }),
  // Its creator, on a board read-only for the others: a reminder that they are the only one drawing.
  container({
    class: badge,
    visible: { source: BOARD_PROVIDER, template: `{{ source.readOnly and ${IS_OWNER} ? 'true' : 'false' }}` },
    children: [icon('fa-regular fa-eye'), text({ content: 'Only you edit' })]
  }),
  container({
    class: badge,
    visible: { source: BOARD_PROVIDER, template: "{{ source.unlisted ? 'true' : 'false' }}" },
    children: [icon('fa-regular fa-eye-slash'), text({ content: 'Private' })]
  }),
  container({
    class: temporaryBadge,
    visible: { source: BOARD_PROVIDER, template: "{{ source.expiresAt ? 'true' : 'false' }}" },
    children: [
      icon('fa-regular fa-hourglass-half'),
      countdown({
        id: 'board-left',
        runtime: 'client',
        class: boardLeft,
        // Its last hour in the danger colour: a board about to go should not surprise anyone on it.
        warnSeconds: 3600,
        bind: [{ to: 'endsAt', source: `${BOARD_PROVIDER}.expiresAt` }],
        flows: [
          [
            declaredTrigger(countdownDeclaration, 'onEnd'),
            addNotification({
              content: 'This board’s time is up — it is gone for everyone',
              appearance: 'info',
              placement: 'top-center',
              autoDismissTimeout: 6000
            }),
            navigate({ urlType: 'internal', url: '/' })
          ]
        ]
      })
    ]
  })
];

const quickButton = styles('quickPrivate', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    'align-items': 'center',
    gap: '8px',
    height: '42px',
    padding: '0px 16px',
    'border-radius': '10px',
    border: '1px solid var(--edge)',
    'font-weight': '600',
    'font-size': '14px',
    'background-color': 'var(--surface)',
    color: 'var(--ink)'
  },
  states: {
    hover: { 'border-color': 'var(--accent)', color: 'var(--accent)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '3px' }
  }
});

/** A board for a quick session: private from the start, and gone in a day with everything on it. */
export const quickPrivateBoard = (): ElementSpec =>
  button({
    id: 'new-private-board',
    content: 'Quick private board',
    title: 'Not listed anywhere, and gone for everyone in a day',
    class: quickButton,
    flows: [
      [
        onClick(),
        named(
          'created',
          runServerAction({
            actionId: CREATE_ACTION,
            input: { title: 'Quick session', visibility: 'private', hours: String(DEFAULT_LIFETIME) },
            invalidateQueries: 'none'
          })
        ),
        keepOwned('created'),
        navigate({ urlType: 'internal', url: '/b/{{ created.output.id }}' })
      ]
    ],
    children: [icon('fa-regular fa-hourglass-half')]
  });
