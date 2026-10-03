import { useCallback } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { chainOf } from '@pmodules/Builder/helpers/elementChain';
import useRevealElement from '@pmodules/Builder/hooks/useRevealElement';

export type ElementChipProps = {
  elementId: string;
  /** Called once the element is on screen, so whatever holds the list can get out of the way. */
  onDismiss: () => void;
};

/**
 * An element named in the list, and the way to it: a link that opens its page or layout, unfolds the tree down to it
 * and selects it. One deleted since the space was saved is named but not linked — there is nothing left to take anyone
 * to, and what named it goes away with the next save.
 */
const ElementChip = ({ elementId, onDismiss }: ElementChipProps) => {
  const [flat] = useBuilderStore('schema.flat');
  const revealElement = useRevealElement();
  const reachable = elementId in flat;

  const handleReveal = useCallback(() => {
    revealElement({ id: elementId, ...chainOf(flat, elementId) });
    onDismiss();
  }, [elementId, flat, onDismiss, revealElement]);

  if (!reachable) {
    return <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{elementId}</span>;
  }

  return (
    <button
      type="button"
      className="self-start rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-indigo-700 hover:bg-indigo-50 dark:bg-zinc-800 dark:text-indigo-300 dark:hover:bg-zinc-700"
      title="Select this element"
      onClick={handleReveal}
    >
      {elementId}
    </button>
  );
};

export default ElementChip;
