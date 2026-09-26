import {
  addNotification,
  bindTemplate,
  button,
  container,
  form,
  formControl,
  link,
  named,
  on,
  onClick,
  onSubmit,
  reloadApi,
  resetForm,
  runServerAction,
  setState,
  styles,
  text,
  when,
  whenFailed
} from '@plitzi/sdk-authoring';

import { LOCK_ACTION, OPEN_ACTION } from '../actions.ts';
import { BOARD_PROVIDER } from './ids.ts';
import { BUTTON_RESET, FLOAT, caption, icon } from './kit.ts';

import type { ElementSpec, Rule, StepSpec } from '@plitzi/sdk-authoring';

/**
 * A board behind a password.
 *
 * The board's own render answers only its name and that it is locked. Opening it — with the password, or with the key
 * kept from the last time — answers everything else: its elements, the topic its channels go by, and the key every
 * change must carry. That answer is `state.opened`, and every binding that shows the board reads it for a locked one.
 */

const PROVIDER = `apiContainer_${BOARD_PROVIDER}`;

/** In a binding whose source is the board: whether what opening answered is for THIS board. */
const OPENED = 'state.opened and state.opened.id == source.id';

/** A field of the board as it is shown: the board's own, or — locked — what opening it answered. */
export const ofBoard = (field: string, fallback: string): string =>
  `(source.locked ? (${OPENED} ? state.opened.${field} : ${fallback}) : source.${field})`;

/** Whether the board can be shown: it exists, and it is open or has been opened. */
export const BOARD_SHOWN = `{{ source.found and (not source.locked or (${OPENED})) ? 'true' : 'false' }}`;

/** In a flow: the key a locked board's changes carry, or nothing for an open board. */
export const BOARD_KEY = `{{ state.opened and state.opened.id == ${PROVIDER}.id ? state.opened.key : '' }}`;

/**
 * The boards this browser made, and the owner key each was given: `state.owned`, an object by board id — kept, so
 * whoever made a board is still its creator tomorrow. The key is what lets a change through while the board is
 * read-only for everyone else, and the only thing that makes it so.
 */
const OWNER_OF = (id: string): string => `(state.owned ? state.owned[${id}] : '')`;

/** In a flow: the owner key of the board shown, or nothing for a board this browser did not make. */
export const BOARD_OWNER = `{{ ${OWNER_OF(`${PROVIDER}.id`)} }}`;

/** What every change to the board carries: the key opening it answered, and — its creator's — the owner key. */
export const BOARD_PASS = { key: BOARD_KEY, owner: BOARD_OWNER };

/** In a binding whose source is the board: whether this browser made it. */
export const IS_OWNER = `${OWNER_OF('source.id')}`;

/** A new board's owner key, kept with the others — the step that made it answered it as `owner`. */
export const keepOwned = (step: string): StepSpec =>
  when(
    { field: `${step}.status`, operator: '=', value: 'completed' },
    setState({
      key: 'owned',
      type: 'json',
      value: `{{ (state.owned ? state.owned : {})|merge({ (${step}.output.id): ${step}.output.owner }) }}`
    })
  );

/**
 * Whether the board shown can be changed here: any board that is not read-only — and a read-only one by whoever made
 * it read-only. Every featured board is one to look around, not to draw on: nobody holds its owner key.
 */
export const CAN_EDIT = `not source.readOnly or ${IS_OWNER}`;

const EDITABLE = { source: BOARD_PROVIDER, template: `{{ ${CAN_EDIT} ? 'true' : 'false' }}` };

const READ_ONLY = { source: BOARD_PROVIDER, template: `{{ ${CAN_EDIT} ? 'false' : 'true' }}` };

/** Leaves its children to the layout around it: a wrapper that only decides whether they are there. */
const contents = styles('contents', { display: 'contents' });

/** What only a board that can change shows: the tools that change it. */
export const editOnly = (children: ElementSpec[]): ElementSpec =>
  container({ class: contents, visible: EDITABLE, children });

/** What only a read-only board shows: that it is one, and what to do instead. */
export const readOnlyOnly = (children: ElementSpec[]): ElementSpec =>
  container({ class: contents, visible: READ_ONLY, children });

/** What opening answered, kept: the board shown, and the key remembered for the next visit. */
const keepOpened = (step: string): StepSpec[] => [
  setState({ key: 'opened', type: 'json', value: `{{ ${step}.output }}` }),
  setState({ key: 'unlock', type: 'json', value: `{{ { 'id': ${step}.output.id, 'key': ${step}.output.key } }}` })
];

const screen = styles('unlockScreen', {
  position: 'absolute',
  inset: '0px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  padding: '24px'
});

const card = styles('unlockCard', {
  ...FLOAT,
  display: 'flex',
  'flex-direction': 'column',
  gap: '14px',
  width: '360px',
  'max-width': '100%',
  padding: '28px'
});

const lockMark = styles('lockMark', { 'font-size': '34px', 'line-height': '1' });

const cardTitle = styles('unlockTitle', { 'font-family': 'var(--hand)', 'font-size': '30px', 'font-weight': '700' });

const cardNote = styles('unlockNote', { color: 'var(--muted)', 'font-size': '14px', 'line-height': '1.5' });

const passwordBox = styles('passwordBox', {
  css: {
    display: 'flex',
    'align-items': 'center',
    height: '40px',
    padding: '0px 12px',
    border: '1px solid var(--edge)',
    'border-radius': '10px',
    'background-color': 'var(--surface-2)'
  },
  states: { 'focus-within': { 'border-color': 'var(--accent)', 'background-color': 'var(--surface)' } }
});

const field = styles('passwordField', { width: '100%' });

export const submitButton = styles('submitButton', {
  css: {
    ...BUTTON_RESET,
    height: '40px',
    'border-radius': '10px',
    'font-weight': '600',
    'font-size': '14px',
    'text-align': 'center',
    'background-color': 'var(--accent)',
    color: 'var(--on-accent)'
  },
  states: {
    hover: { filter: 'brightness(1.08)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
  }
});

const backLink = styles('unlockBack', {
  css: {
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    gap: '8px',
    height: '34px',
    'border-radius': '8px',
    'font-size': '13px',
    'font-weight': '600',
    color: 'var(--muted)',
    'text-decoration': 'none'
  },
  states: {
    hover: { color: 'var(--ink)', 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
  }
});

const quietButton = styles('quietButton', {
  css: {
    ...BUTTON_RESET,
    height: '34px',
    padding: '0px 12px',
    'border-radius': '8px',
    'font-weight': '600',
    'font-size': '13px',
    'text-align': 'center',
    'background-color': 'var(--surface-2)',
    color: 'var(--ink)'
  },
  states: { hover: { 'background-color': 'var(--edge)' } }
});

const passwordField = (id: string, placeholder: string): ElementSpec =>
  formControl({
    id,
    name: 'password',
    subType: 'password',
    label: '',
    placeholder,
    required: false,
    autoComplete: false,
    class: field,
    slots: { input: passwordBox }
  });

const told = (content: string, appearance: 'success' | 'danger' | 'info'): StepSpec =>
  addNotification({ content, appearance, placement: 'bottom-center', autoDismissTimeout: 4000 });

/**
 * Asked for a locked board's password — and, before asking, the key this visitor kept from the last time is tried:
 * somebody who opened the board yesterday is not asked again, until the password changes.
 */
export const unlockScreen = (): ElementSpec =>
  container({
    id: 'unlock',
    class: screen,
    visible: {
      source: BOARD_PROVIDER,
      template: `{{ source.found and source.locked and not (${OPENED}) ? 'true' : 'false' }}`
    },
    flows: [
      [
        on('onLoad'),
        when(
          [
            { field: `${PROVIDER}.locked`, operator: '=', value: true },
            { field: 'state.unlock.id', operator: '=', value: `${PROVIDER}.id`, isBinding: true }
          ],
          named(
            'reopened',
            runServerAction({
              actionId: OPEN_ACTION,
              input: { id: `{{ ${PROVIDER}.id }}`, key: '{{ state.unlock.key }}' },
              invalidateQueries: 'none'
            })
          )
        ),
        ...keepOpened('reopened').map(step =>
          when({ field: 'reopened.status', operator: '=', value: 'completed' }, step)
        )
      ]
    ],
    children: [
      form({
        id: 'unlock-form',
        class: card,
        managedByInteractions: true,
        noValidate: true,
        flows: [
          [
            named('asked', onSubmit()),
            named(
              'unlocked',
              runServerAction({
                actionId: OPEN_ACTION,
                input: { id: `{{ ${PROVIDER}.id }}`, password: '{{ asked.values.password }}' },
                invalidateQueries: 'none'
              })
            ),
            ...keepOpened('unlocked').map(step =>
              when({ field: 'unlocked.status', operator: '=', value: 'completed' }, step)
            ),
            whenFailed(
              'unlocked',
              told('{{ unlocked.error ? unlocked.error : "That is not this board’s password" }}', 'danger')
            )
          ]
        ],
        children: [
          text({ content: '🔒', class: lockMark }),
          text({ content: 'This board is locked', class: cardTitle }),
          text({
            content: 'Whoever set it up gave it a password. Type it once — this browser remembers it until it changes.',
            class: cardNote
          }),
          passwordField('unlock-password', 'Password'),
          button({ id: 'unlock-open', subType: 'submit', content: 'Open the board', class: submitButton }),
          link({
            href: '/',
            mode: 'internal',
            class: backLink,
            label: 'All boards',
            children: [icon('fa-solid fa-chevron-left'), text({ content: 'Back to all boards' })]
          })
        ]
      })
    ]
  });

/**
 * Changing the password — to `password`, or to none with an empty one. Whoever does it stays in: the answer carries
 * the new key, and the board is opened again with it. Everyone else on the board is told on its old topic — and this
 * page, named in the change (`by`), knows the announcement for its own and goes on as it is. `step` names the run, so
 * the form and the remove button each have their own.
 */
const lockSteps = (step: string, password: string): StepSpec[] => {
  const reopened = `${step}Reopened`;
  const done: Rule = { field: `${step}.status`, operator: '=', value: 'completed' };
  const said = (locked: boolean, wasLocked: boolean, content: string, appearance: 'success' | 'info'): StepSpec =>
    when(
      [
        { field: `${step}.output.locked`, operator: '=', value: locked },
        { field: `${step}.output.wasLocked`, operator: '=', value: wasLocked }
      ],
      told(content, appearance)
    );

  return [
    named(
      step,
      runServerAction({
        actionId: LOCK_ACTION,
        input: { board: `{{ ${PROVIDER}.id }}`, password, by: '{{ computed.tab }}', ...BOARD_PASS },
        invalidateQueries: 'none'
      })
    ),
    // The server says what was wrong with it — too short, too easy to guess — in words written for whoever typed it.
    whenFailed(
      step,
      told(`{{ ${step}.error ? ${step}.error : "The password could not be changed — try again" }}`, 'danger')
    ),
    when(
      done,
      named(
        reopened,
        runServerAction({
          actionId: OPEN_ACTION,
          input: { id: `{{ ${step}.output.id }}`, key: `{{ ${step}.output.key }}` },
          invalidateQueries: 'none'
        })
      )
    ),
    ...keepOpened(reopened).map(kept => when({ field: `${reopened}.status`, operator: '=', value: 'completed' }, kept)),
    when(done, resetForm('lock-form')),
    when(done, reloadApi(BOARD_PROVIDER)),
    said(true, false, '🔒 Password set — share it with whoever should get in', 'success'),
    said(true, true, '🔒 Password changed — whoever had the old one is asked for this one', 'success'),
    said(false, true, '🔓 Password removed — anyone with the link gets in', 'info')
  ];
};

const statusRow = styles('lockStatus', {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  padding: '8px 10px',
  'border-radius': '9px',
  'font-size': '12px',
  'line-height': '1.4',
  'background-color': 'var(--surface-2)'
});

const lockedStatus = styles('lockStatusOn', { color: 'var(--accent)', 'background-color': 'var(--accent-soft)' });

const removeButton = styles('lockRemove', {
  css: {
    ...BUTTON_RESET,
    height: '30px',
    'border-radius': '8px',
    'font-weight': '600',
    'font-size': '12px',
    'text-align': 'center',
    color: 'var(--danger)'
  },
  states: {
    hover: { 'background-color': 'var(--surface-2)' },
    'focus-visible': { outline: '2px solid var(--danger)', 'outline-offset': '1px' }
  }
});

/**
 * The password, in the board's settings: whether it has one — a password is never shown back, so the panel says so in
 * words — a field to set or change it, and an explicit way to remove it.
 */
export const passwordSection = (): ElementSpec[] => [
  text({ content: 'Password', class: caption }),
  container({
    class: styles('lockStatusRow', { display: 'contents' }),
    visible: { source: BOARD_PROVIDER, template: "{{ source.locked ? 'true' : 'false' }}" },
    children: [
      container({
        id: 'lock-status-on',
        class: [statusRow, lockedStatus],
        children: [
          icon('fa-solid fa-lock'),
          text({ content: 'Protected — whoever opens the link is asked for the password.' })
        ]
      })
    ]
  }),
  container({
    class: styles('lockStatusRowOff', { display: 'contents' }),
    visible: { source: BOARD_PROVIDER, template: "{{ source.locked ? 'false' : 'true' }}" },
    children: [
      container({
        id: 'lock-status-off',
        class: statusRow,
        children: [icon('fa-solid fa-lock-open'), text({ content: 'No password — anyone with the link gets in.' })]
      })
    ]
  }),
  form({
    id: 'lock-form',
    managedByInteractions: true,
    noValidate: true,
    class: styles('lockForm', { display: 'flex', 'flex-direction': 'column', gap: '8px' }),
    flows: [
      [
        named('setting', onSubmit()),
        // Only an empty field is caught here — sent, it would REMOVE the password. Every other rule is the server's.
        // `empty`, not `= ''`: a field nobody typed in sends no value at all.
        when(
          { field: 'setting.values.password', operator: 'empty', value: '' },
          told('Type a password first', 'danger')
        ),
        ...lockSteps('locked', '{{ setting.values.password }}').map(step =>
          when({ field: 'setting.values.password', operator: 'notEmpty', value: '' }, step)
        )
      ]
    ],
    children: [
      passwordField('lock-password', 'New password'),
      button({
        id: 'lock-set',
        subType: 'submit',
        content: 'Set password',
        class: quietButton,
        bind: [bindTemplate('content', BOARD_PROVIDER, "{{ source.locked ? 'Change password' : 'Set password' }}")]
      })
    ]
  }),
  container({
    class: styles('lockRemoveRow', { display: 'contents' }),
    visible: { source: BOARD_PROVIDER, template: "{{ source.locked ? 'true' : 'false' }}" },
    children: [
      button({
        id: 'lock-remove',
        content: 'Remove password',
        class: removeButton,
        flows: [[onClick(), ...lockSteps('cleared', '')]]
      })
    ]
  })
];
