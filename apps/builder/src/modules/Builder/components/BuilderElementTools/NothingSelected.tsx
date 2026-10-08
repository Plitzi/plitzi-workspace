import { use } from 'react';

import KeyboardKey from '@pmodules/Keyboard';
import { SHORTCUT_GROUPS, ShortcutsContext } from '@pmodules/Shortcuts';

const KEY_CLASS = 'border-gray-200 bg-gray-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';

/** The groups taught here: the keys that act on what gets selected. The rest are one `?` away. */
const TAUGHT = new Set(['Canvas', 'History']);

const shortcuts = SHORTCUT_GROUPS.filter(group => TAUGHT.has(group.title)).flatMap(group => group.shortcuts);

/**
 * What the tools say before anything is chosen: how to choose, and the keys that work on what is chosen — the place
 * an author looks while learning the canvas, so the place the shortcuts are taught.
 */
const NothingSelected = () => {
  const { openHelp } = use(ShortcutsContext);

  return (
    <div className="m-3 flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="bg-primary-50 text-primary-600 dark:bg-primary-400/15 dark:text-primary-300 flex h-9 w-9 items-center justify-center rounded-lg">
          <i className="fa-solid fa-arrow-pointer" />
        </span>
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Nothing selected</span>
        <span>Click an element on the canvas, or pick one in Layers, to style it and wire it up.</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shortcuts.map(shortcut => (
          <li key={shortcut.label} className="flex items-center justify-between gap-2">
            <span>{shortcut.label}</span>
            <span className="flex gap-1">
              {shortcut.keys.map(key => (
                <KeyboardKey key={key.char} className={KEY_CLASS} commandChar={!!key.command} char={key.char} />
              ))}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="hover:text-primary-600 dark:hover:text-primary-300 flex items-center justify-between gap-2 text-left"
        onClick={openHelp}
      >
        <span>Every shortcut</span>
        <KeyboardKey className={KEY_CLASS} commandChar={false} char="?" />
      </button>
    </div>
  );
};

export default NothingSelected;
