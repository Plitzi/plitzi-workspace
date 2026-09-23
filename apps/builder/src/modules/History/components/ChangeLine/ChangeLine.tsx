import { useCallback } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { chainOf } from '@pmodules/Builder/helpers/elementChain';
import useRevealElement from '@pmodules/Builder/hooks/useRevealElement';

import type { ChangeLine as Line } from '@plitzi/sdk-shared/history';

export type ChangeLineProps = { line: Line };

const TEXT = 'text-xs leading-5 text-zinc-700 dark:text-zinc-200';

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
    <li className="flex">
      {reachable && (
        <button
          type="button"
          className={`${TEXT} text-left underline-offset-2 hover:text-indigo-700 hover:underline dark:hover:text-indigo-300`}
          title="Select this element"
          onClick={handleReveal}
        >
          {line.text}
        </button>
      )}
      {!reachable && <span className={TEXT}>{line.text}</span>}
    </li>
  );
};

export default ChangeLine;
