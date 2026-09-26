import { container, onClick, styles, text, toggleState } from '@plitzi/sdk-authoring';

import { editOnly, passwordSection } from './access.ts';
import { BELOW_HEADER, FLOAT, iconAction } from './kit.ts';
import { closeOthers } from './panels.ts';
import { editingSection, reachSection } from './reach.ts';

import type { ElementSpec } from '@plitzi/sdk-authoring';

/**
 * The board's own settings, beside its name: who can find it and how long it lasts (`reach.ts`), who can change it —
 * for its creator — and its password (`access.ts`). Share is for inviting people; what the board IS lives here.
 */

const popover = styles('settingsPopover', {
  css: {
    desktop: {
      ...FLOAT,
      position: 'absolute',
      top: BELOW_HEADER,
      left: '14px',
      'z-index': '6',
      display: 'flex',
      'flex-direction': 'column',
      gap: '12px',
      width: '300px',
      'max-height': 'calc(100dvh - 90px)',
      'overflow-y': 'auto',
      padding: '14px'
    },
    mobile: { left: '10px', right: '10px', width: 'auto' }
  }
});

const title = styles('settingsTitle', { 'font-size': '14px', 'font-weight': '600', color: 'var(--ink)' });

export const settingsButton = (): ElementSpec =>
  iconAction({
    id: 'settings-open',
    icon: 'fa-solid fa-sliders',
    title: 'Board settings — who can find it, how long it lasts, password',
    flow: [onClick(), ...closeOthers('settingsOpen'), toggleState({ key: 'settingsOpen' })]
  });

export const settingsPanel = (): ElementSpec =>
  editOnly([
    container({
      id: 'settings-panel',
      class: popover,
      visible: 'computed.settingsOpen',
      children: [
        text({ content: 'Board settings', class: title }),
        ...reachSection(),
        editingSection(),
        ...passwordSection()
      ]
    })
  ]);
