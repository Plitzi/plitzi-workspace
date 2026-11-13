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

const OPTION = 'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left text-xs text-ui-fg';

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
      className="border-ui-line bg-ui-overlay flex max-h-72 w-full flex-col gap-0.5 overflow-y-auto rounded-md border p-1 shadow-lg"
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
            'hover:bg-ui-hover': highlighted !== 0
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
        <span className="text-ui-fg-subtle px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider uppercase">
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
            'hover:bg-ui-hover': highlighted !== index + offset
          })}
          title={`${selector.type}: ${selector.name}`}
          // Before the field loses focus to the click: picked as the list closes, not after.
          onMouseDown={() => onSelect?.(selector)}
        >
          <span className="text-ui-fg-subtle w-3 text-center font-mono font-bold">.</span>
          <span className="truncate font-mono">{selector.name}</span>
        </button>
      ))}
      {!creates && list.length === 0 && (
        <span className="text-ui-fg-subtle px-2 py-3 text-center text-xs">
          No other class in the space. Type a name to create one.
        </span>
      )}
    </div>
  );
};

export default SelectorSuggestions;
