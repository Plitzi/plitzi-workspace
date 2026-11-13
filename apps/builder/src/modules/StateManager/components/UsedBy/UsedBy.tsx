import { useCallback } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { chainOf } from '@pmodules/Builder/helpers/elementChain';
import useRevealElement from '@pmodules/Builder/hooks/useRevealElement';

export type UsedByProps = {
  reads: string[];
  writes: string[];
};

/** The elements that read a key and those whose steps write it, each a link that takes you to it. */
const UsedBy = ({ reads, writes }: UsedByProps) => {
  const [flat] = useBuilderStore('schema.flat');
  const revealElement = useRevealElement();

  const handleReveal = useCallback(
    (id: string) => () => revealElement({ id, ...chainOf(flat, id) }),
    [flat, revealElement]
  );

  const group = (title: string, ids: string[]) =>
    ids.length > 0 && (
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-ui-fg-subtle w-12 shrink-0 text-[10px] font-semibold tracking-wider uppercase">
          {title}
        </span>
        {ids.map(id => (
          <button
            key={id}
            type="button"
            className="bg-ui-raised text-primary-text hover:bg-ui-hover cursor-pointer rounded-sm px-1.5 py-0.5 font-mono text-[11px]"
            title="Select this element"
            onClick={handleReveal(id)}
          >
            {id}
          </button>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-1.5 pt-1.5 pb-1">
      {group('Read', reads)}
      {group('Written', writes)}
      {reads.length === 0 && writes.length === 0 && (
        <span className="text-ui-fg-subtle text-[11px]">Nothing in the space reads or writes it.</span>
      )}
    </div>
  );
};

export default UsedBy;
