import { memo, use } from 'react';

import KeyboardKey from '@pmodules/Keyboard';

import BuilderSearchContext from '../../BuilderSearchContext';

const BuilderSearchButton = () => {
  const { openSearch } = use(BuilderSearchContext);

  return (
    <button
      type="button"
      title="Find an element in any page or layout"
      aria-label="Find an element"
      onClick={openSearch}
      className="text-ui-fg-subtle hover:text-ui-fg dark:border-ui-line-strong dark:bg-ui-raised dark:hover:border-ui-line-strong flex h-7 cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-2 text-xs transition-colors hover:border-neutral-400"
    >
      <i className="fa-solid fa-magnifying-glass" />
      {/* Under 1,536 px the bar holds the icon alone: it needed 1,564 px, and Publish was past the window. */}
      <span className="hidden 2xl:inline">Find</span>
      <KeyboardKey
        className="text-ui-fg-subtle dark:border-ui-line-strong dark:bg-ui-backdrop hidden border-neutral-300 bg-neutral-100 2xl:inline-flex"
        char="P"
      />
    </button>
  );
};

export default memo(BuilderSearchButton);
