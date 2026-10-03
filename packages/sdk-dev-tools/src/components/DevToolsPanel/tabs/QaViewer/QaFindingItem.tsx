import { useCallback } from 'react';

import type { QaFinding } from '../../../../qa/scans';

/** The class the dev tools outline an element with when a tab points at it. */
const POINTED = 'devtools-element-hovered';

/** How long a finding stays pointed at after it is picked. */
const POINT_MS = 1600;

export type QaFindingItemProps = { finding: QaFinding };

/** One thing a check found: what it is and what is wrong — picked, the page scrolls to it and points at it. */
const QaFindingItem = ({ finding: { element, note } }: QaFindingItemProps) => {
  const name = element.getAttribute('data-plitzi-el');

  const handleClick = useCallback(() => {
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    element.classList.add(POINTED);
    setTimeout(() => element.classList.remove(POINTED), POINT_MS);
  }, [element]);

  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-center gap-2 px-3 py-1 pl-6 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
      onClick={handleClick}
    >
      <span className="shrink-0 font-mono text-zinc-500 dark:text-zinc-400">{element.tagName.toLowerCase()}</span>
      {name && <span className="truncate font-mono text-violet-600 dark:text-violet-400">{name}</span>}
      <span className="ml-auto shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">{note}</span>
    </button>
  );
};

export default QaFindingItem;
