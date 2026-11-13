import clsx from 'clsx';
import { useCallback } from 'react';

import type { Suggestions } from './helpers';
import type { SelectorValue } from '../Selector';

export type SelectorSuggestionsProps = {
  suggestions: Suggestions;
  /** The option the keys are on: 0 is the class to create when there is one, then the list. */
  highlighted?: number;
  onSelect?: (tag: SelectorValue) => void;
  onCreate?: (tag: SelectorValue) => void;
};

const OPTION =
  'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left text-xs text-zinc-700 dark:text-zinc-200';

/** The classes to add, filtered by what is typed, and the one to create when nothing has that name. */
const SelectorSuggestions = ({ suggestions, highlighted = -1, onSelect, onCreate }: SelectorSuggestionsProps) => {
  const { creates, list } = suggestions;
  const offset = creates ? 1 : 0;

  const handleCreate = useCallback(() => {
    if (creates) {
      onCreate?.({ name: creates, type: 'class' });
    }
  }, [creates, onCreate]);

  return (
    <div
      className="flex max-h-72 w-full flex-col gap-0.5 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      role="listbox"
      aria-label="Classes"
    >
      {creates && (
        <button
          type="button"
          role="option"
          aria-selected={highlighted === 0}
          className={clsx(OPTION, {
            'bg-primary-50 dark:bg-primary-400/15': highlighted === 0,
            'hover:bg-gray-100 dark:hover:bg-zinc-800': highlighted !== 0
          })}
          onMouseDown={handleCreate}
        >
          <i className="fa-solid fa-plus text-primary-600 dark:text-primary-300 w-3 text-[10px]" />
          <span>
            Create class <b className="font-mono">.{creates}</b>
          </span>
        </button>
      )}
      {list.length > 0 && (
        <span className="px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
          Classes
        </span>
      )}
      {list.map((selector, index) => (
        <button
          key={selector.name}
          type="button"
          role="option"
          aria-selected={highlighted === index + offset}
          className={clsx(OPTION, {
            'bg-primary-50 dark:bg-primary-400/15': highlighted === index + offset,
            'hover:bg-gray-100 dark:hover:bg-zinc-800': highlighted !== index + offset
          })}
          title={`${selector.type}: ${selector.name}`}
          // Before the field loses focus to the click: picked as the list closes, not after.
          onMouseDown={() => onSelect?.(selector)}
        >
          <span className="w-3 text-center font-mono font-bold text-zinc-400 dark:text-zinc-500">.</span>
          <span className="truncate font-mono">{selector.name}</span>
        </button>
      ))}
      {!creates && list.length === 0 && (
        <span className="px-2 py-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
          No other class in the space. Type a name to create one.
        </span>
      )}
    </div>
  );
};

export default SelectorSuggestions;
