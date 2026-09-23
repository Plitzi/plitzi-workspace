import { useCallback } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { chainOf } from '@pmodules/Builder/helpers/elementChain';
import useRevealElement from '@pmodules/Builder/hooks/useRevealElement';

import LineLabel from '../LineLabel';

import type { ChangeLine as Line } from '@plitzi/sdk-shared/history';

export type ChangeLineProps = { line: Line };

/**
 * One thing a save did. When it is about an element that is still in the space, the line is the way to it — the same
 * way the problems list takes someone to an element.
 */
const ChangeLine = ({ line }: ChangeLineProps) => {
  const [flat] = useBuilderStore('schema.flat');
  const revealElement = useRevealElement();
  const { elementId } = line;
  const reachable = elementId !== undefined && elementId in flat;

  const handleReveal = useCallback(() => {
    if (elementId !== undefined) {
      revealElement({ id: elementId, ...chainOf(flat, elementId) });
    }
  }, [elementId, flat, revealElement]);

  return (
    <li className="flex text-zinc-700 dark:text-zinc-200">
      {reachable && (
        <button
          type="button"
          className="-mx-1 cursor-pointer rounded px-1 text-left underline-offset-2 hover:bg-indigo-50 hover:text-indigo-700 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
          title="Select this element"
          onClick={handleReveal}
        >
          <LineLabel line={line} />
        </button>
      )}
      {!reachable && <LineLabel line={line} />}
    </li>
  );
};

export default ChangeLine;
