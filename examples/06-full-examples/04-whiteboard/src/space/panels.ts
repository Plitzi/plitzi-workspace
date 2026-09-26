import { container, onClick, setState, styles } from '@plitzi/sdk-authoring';

import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The board's popovers — you, share, the timer, deleting, the reactions, the shapes, the frames — and how they close: Escape (`keys.ts`), or a click
 * anywhere outside them. The click lands on a layer spread under the open popover and over everything else, so it
 * closes the popover and does nothing more: a click meant to dismiss never draws on the board behind.
 */

export const PANELS = [
  'shareOpen',
  'meOpen',
  'keysOpen',
  'timerOpen',
  'deleteOpen',
  'reactOpen',
  'shapesOpen',
  'linesOpen',
  'drawOpen',
  'notesOpen',
  'kanbanOpen',
  'framesOpen',
  'agentOpen',
  'libraryOpen',
  'settingsOpen',
  'stampOpen'
] as const;

export const closePanels: StepSpec[] = PANELS.map(key => setState({ key, type: 'boolean', value: false }));

/** Every popover but `keep` closed — what opening one does, so two are never open at once. */
export const closeOthers = (keep: (typeof PANELS)[number]): StepSpec[] =>
  PANELS.filter(key => key !== keep).map(key => setState({ key, type: 'boolean', value: false }));

/** Under the popovers (z-index 6) and over the rest of the chrome: nothing shows through it, a click lands on it. */
const backdrop = styles('popoverBackdrop', {
  position: 'absolute',
  inset: '0px',
  'z-index': '5',
  'pointer-events': 'auto'
});

export const popoverBackdrop = (): ElementSpec =>
  container({
    id: 'popover-backdrop',
    class: backdrop,
    visible: 'computed.popoverOpen',
    flows: [[onClick(), ...closePanels]]
  });
