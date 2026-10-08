import { elementOf } from '@plitzi/sdk-shared/helpers/eventTarget';
import { deleteKey } from '@pmodules/Keyboard';

/** One key of a shortcut as its keycap reads — `command` puts the platform's modifier (⌘ / Ctrl) in front of it. */
export type ShortcutKey = { char: string; command?: boolean };

export type Shortcut = { label: string; keys: ShortcutKey[] };

export type ShortcutGroup = { title: string; shortcuts: Shortcut[] };

/**
 * Every shortcut the builder answers to, and only those: the help sheet (`?`) and the card shown while nothing is
 * selected both read this list, so a key that is listed is a key that works.
 */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Canvas',
    shortcuts: [
      { label: 'Find any element', keys: [{ char: 'P', command: true }] },
      { label: 'Measure distances', keys: [{ char: 'Hold Alt' }] },
      { label: 'Deselect', keys: [{ char: 'Esc' }] },
      { label: 'Delete the selected element', keys: [{ char: deleteKey }] }
    ]
  },
  {
    title: 'History',
    shortcuts: [
      { label: 'Undo', keys: [{ char: 'Z', command: true }] },
      { label: 'Redo', keys: [{ char: 'Y', command: true }] }
    ]
  },
  {
    title: 'Workspace',
    shortcuts: [
      { label: 'Hide or bring back the side panels', keys: [{ char: '\\', command: true }] },
      { label: 'Show these shortcuts', keys: [{ char: '?' }] }
    ]
  },
  {
    title: 'Style inspector',
    shortcuts: [{ label: 'Clear the property search', keys: [{ char: 'Esc' }] }]
  }
];

/** Where a key is text being typed, not a command: an input, a textarea, a select or anything editable. */
export const isTypingTarget = (target: EventTarget | null): boolean =>
  !!elementOf(target)?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');

export const isHelpShortcut = (e: KeyboardEvent): boolean =>
  e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target);

export const isPanelsShortcut = (e: KeyboardEvent): boolean =>
  (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === '\\';
