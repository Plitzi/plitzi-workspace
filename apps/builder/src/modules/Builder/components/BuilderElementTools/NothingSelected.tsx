import KeyboardKey, { deleteKey } from '@pmodules/Keyboard';

const KEY_CLASS = 'border-gray-200 bg-gray-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';

/**
 * What the tools say before anything is chosen: how to choose, and the keys that work on what is chosen — the place
 * an author looks while learning the canvas, so the place the shortcuts are taught.
 */
const NothingSelected = () => (
  <div className="m-3 flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="bg-primary-50 text-primary-600 dark:bg-primary-400/15 dark:text-primary-300 flex h-9 w-9 items-center justify-center rounded-lg">
        <i className="fa-solid fa-arrow-pointer" />
      </span>
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Nothing selected</span>
      <span>Click an element on the canvas, or pick one in Layers, to style it and wire it up.</span>
    </div>
    <ul className="flex flex-col gap-2">
      <li className="flex items-center justify-between gap-2">
        <span>Find any element</span>
        <KeyboardKey className={KEY_CLASS} char="P" />
      </li>
      <li className="flex items-center justify-between gap-2">
        <span>Measure distances</span>
        <KeyboardKey className={KEY_CLASS} commandChar={false} char="Hold Alt" />
      </li>
      <li className="flex items-center justify-between gap-2">
        <span>Deselect</span>
        <KeyboardKey className={KEY_CLASS} commandChar={false} char="Esc" />
      </li>
      <li className="flex items-center justify-between gap-2">
        <span>Delete the selected element</span>
        <KeyboardKey className={KEY_CLASS} commandChar={false} char={deleteKey} />
      </li>
      <li className="flex items-center justify-between gap-2">
        <span>Undo · redo</span>
        <span className="flex gap-1">
          <KeyboardKey className={KEY_CLASS} char="Z" />
          <KeyboardKey className={KEY_CLASS} char="Y" />
        </span>
      </li>
    </ul>
  </div>
);

export default NothingSelected;
