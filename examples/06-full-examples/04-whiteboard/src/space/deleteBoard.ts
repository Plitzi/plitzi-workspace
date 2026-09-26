import {
  addNotification,
  button,
  container,
  named,
  navigate,
  onClick,
  runServerAction,
  setState,
  styles,
  text,
  toggleState,
  when,
  whenFailed
} from '@plitzi/sdk-authoring';

import { DELETE_ACTION } from '../actions.ts';
import { BOARD_PASS } from './access.ts';
import { BOARD_PROVIDER } from './ids.ts';
import { BELOW_HEADER, BUTTON_RESET, FLOAT, iconAction } from './kit.ts';
import { closeOthers } from './panels.ts';

import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * Deleting a board: asked once, then done for everyone. The server removes it and says so on the board's channel,
 * where every page on it — this one included — is sent back to the boards (`board.ts`, the `feed` channel).
 */

const popover = styles('deletePopover', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: BELOW_HEADER,
      left: '14px',
      'z-index': '6',
      display: 'flex',
      'flex-direction': 'column',
      gap: '10px',
      width: '284px',
      padding: '16px'
    },
    mobile: { left: '10px', right: '10px', width: 'auto' }
  }
});

const title = styles('deleteTitle', { 'font-weight': '700', 'font-size': '15px' });

const note = styles('deleteNote', { 'font-size': '13px', 'line-height': '1.5', color: 'var(--muted)' });

const actions = styles('deleteActions', { display: 'flex', 'justify-content': 'flex-end', gap: '8px' });

const BUTTON = {
  ...BUTTON_RESET,
  height: '34px',
  padding: '0px 14px',
  'border-radius': '8px',
  'font-weight': '600',
  'font-size': '13px'
};

const cancel = styles('deleteCancel', {
  css: { ...BUTTON, 'background-color': 'var(--surface-2)', color: 'var(--ink)' },
  states: { hover: { 'background-color': 'var(--edge)' } }
});

const confirm = styles('deleteConfirm', {
  css: { ...BUTTON, 'background-color': 'var(--danger)', color: '#ffffff' },
  states: {
    hover: { filter: 'brightness(1.08)' },
    'focus-visible': { outline: '2px solid var(--danger)', 'outline-offset': '2px' }
  }
});

const closeDelete = setState({ key: 'deleteOpen', type: 'boolean', value: false });

export const deleteButton = (): ElementSpec =>
  iconAction({
    id: 'delete-open',
    icon: 'fa-regular fa-trash-can',
    title: 'Delete this board — for everyone',
    flow: [onClick(), ...closeOthers('deleteOpen'), toggleState({ key: 'deleteOpen' })]
  });

const deleteFlow: StepSpec[] = [
  onClick(),
  closeDelete,
  named(
    'removed',
    runServerAction({
      actionId: DELETE_ACTION,
      input: { board: `{{ apiContainer_${BOARD_PROVIDER}.id }}`, ...BOARD_PASS },
      invalidateQueries: 'none'
    })
  ),
  whenFailed(
    'removed',
    addNotification({
      content: '{{ removed.error ? removed.error : "The board could not be deleted" }}',
      appearance: 'danger',
      placement: 'bottom-center',
      autoDismissTimeout: 5000
    })
  ),
  // The channel sends everyone home; this page goes at once rather than waiting for its own announcement.
  when({ field: 'removed.status', operator: '=', value: 'completed' }, navigate({ urlType: 'internal', url: '/' }))
];

export const deletePanel = (): ElementSpec =>
  container({
    id: 'delete-panel',
    class: popover,
    visible: 'computed.deleteOpen',
    children: [
      text({ content: 'Delete this board?', class: title }),
      text({
        content: 'It goes for everyone: whoever is on it now is sent back to the boards. This cannot be undone.',
        class: note
      }),
      container({
        class: actions,
        children: [
          button({ id: 'delete-cancel', content: 'Cancel', class: cancel, flows: [[onClick(), closeDelete]] }),
          button({ id: 'delete-confirm', content: 'Delete board', class: confirm, flows: [deleteFlow] })
        ]
      })
    ]
  });
