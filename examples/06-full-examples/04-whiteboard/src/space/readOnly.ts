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
  variantFrom,
  when,
  whenFailed
} from '@plitzi/sdk-authoring';

import { COPY_ACTION } from '../actions.ts';
import { BOARD_KEY, readOnlyOnly } from './access.ts';
import { BOARD_PROVIDER } from './ids.ts';
import { BUTTON_RESET, FLOAT, ICON_BUTTON, icon } from './kit.ts';

import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * A read-only board's one piece of chrome, where the toolbar would be: what it is, a laser to point with — looking
 * around together is what it is for — and the way to a board of one's own drawn just like it.
 */

const banner = styles('readOnlyBanner', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      'z-index': '3',
      display: 'flex',
      'align-items': 'center',
      gap: '10px',
      padding: '5px 5px 5px 14px',
      'white-space': 'nowrap'
    },
    mobile: { top: 'auto', bottom: '84px', 'padding-left': '10px' }
  }
});

const label = styles('readOnlyLabel', {
  css: {
    desktop: { display: 'inline-flex', 'align-items': 'center', gap: '8px', 'font-size': '13px', 'font-weight': '600' },
    mobile: { display: 'none' }
  }
});

const hint = styles('readOnlyHint', { 'font-weight': '400', color: 'var(--muted)' });

const laser = styles('readOnlyLaser', {
  css: { ...ICON_BUTTON, width: '36px', height: '36px' },
  states: { hover: { 'background-color': 'var(--surface-2)' } },
  variants: { active: { 'background-color': 'var(--accent-soft)', color: 'var(--accent)' } }
});

const useTemplate = styles('useTemplate', {
  css: {
    ...BUTTON_RESET,
    display: 'inline-flex',
    'align-items': 'center',
    gap: '8px',
    height: '36px',
    padding: '0px 14px',
    'border-radius': '9px',
    'font-weight': '600',
    'font-size': '13px',
    'background-color': 'var(--accent)',
    color: 'var(--on-accent)'
  },
  states: {
    hover: { filter: 'brightness(1.08)' },
    'focus-visible': { outline: '2px solid var(--accent)', 'outline-offset': '2px' }
  }
});

export const readOnlyBanner = (): ElementSpec =>
  readOnlyOnly([
    container({
      id: 'read-only',
      class: banner,
      children: [
        container({
          class: label,
          children: [
            icon('fa-regular fa-eye'),
            text({ content: 'Read-only example' }),
            text({ content: '— look around together', class: hint })
          ]
        }),
        button({
          id: 'read-only-laser',
          content: '',
          title: 'Laser pointer — K',
          class: laser,
          bind: [variantFrom(laser, 'computed.tool', { template: "{{ source == 'laser' ? 'active' : '' }}" })],
          flows: [
            [
              onClick(),
              setState({ key: 'tool', type: 'text', value: "{{ computed.tool == 'laser' ? 'select' : 'laser' }}" })
            ]
          ],
          children: [icon('fa-solid fa-wand-magic-sparkles')]
        }),
        button({
          id: 'use-template',
          content: 'Use as template',
          title: 'A board of your own, drawn just like this one',
          class: useTemplate,
          flows: [
            [
              onClick(),
              named(
                'copied',
                runServerAction({
                  actionId: COPY_ACTION,
                  input: { board: `{{ apiContainer_${BOARD_PROVIDER}.id }}`, key: BOARD_KEY },
                  invalidateQueries: 'none'
                })
              ),
              whenFailed(
                'copied',
                addNotification({
                  content: '{{ copied.error ? copied.error : "The copy could not be made" }}',
                  appearance: 'danger',
                  placement: 'bottom-center',
                  autoDismissTimeout: 5000
                })
              ),
              when(
                { field: 'copied.status', operator: '=', value: 'completed' },
                navigate({ urlType: 'internal', url: '/b/{{ copied.output.id }}' })
              )
            ]
          ],
          children: [icon('fa-regular fa-copy')]
        })
      ]
    })
  ]);
