import { memo, use } from 'react';

import KeyboardKey from '@pmodules/AI/components/KeyboardKey';

import BuilderSearchContext from '../../BuilderSearchContext';

const BuilderSearchButton = () => {
  const { openSearch } = use(BuilderSearchContext);

  return (
    <button
      type="button"
      title="Find an element in any page or layout"
      onClick={openSearch}
      className="flex h-7 cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-2 text-xs text-zinc-500 transition-colors hover:border-neutral-400 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
    >
      <i className="fa-solid fa-magnifying-glass" />
      <span>Find</span>
      <KeyboardKey
        className="border-neutral-300 bg-neutral-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400"
        char="P"
      />
    </button>
  );
};

export default memo(BuilderSearchButton);
