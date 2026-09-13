import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { use, useCallback, useEffect, useRef } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import type { ElementMatch } from '../../helpers/searchElements';

export type ElementMatchItemProps = {
  match: ElementMatch;
  /** The page or layout the match lives in, when saying so helps: left out for the root already on screen. */
  rootLabel?: string;
  /** Highlighted by the keyboard, and kept scrolled into view. */
  active?: boolean;
  onSelect: (match: ElementMatch) => void;
  onHover?: (match?: ElementMatch) => void;
};

const ElementMatchItem = ({ match, rootLabel, active = false, onSelect, onHover }: ElementMatchItemProps) => {
  const ref = useRef<HTMLButtonElement>(null);
  const { componentDefinitions } = use(ComponentContext);

  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [active]);

  const handleClick = useCallback(() => onSelect(match), [match, onSelect]);

  const handleMouseEnter = useCallback(() => onHover?.(match), [match, onHover]);

  const handleMouseLeave = useCallback(() => onHover?.(undefined), [onHover]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={clsx(
        'flex w-full min-w-0 items-center gap-2 rounded px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-zinc-800',
        { 'bg-gray-100 dark:bg-zinc-800': active }
      )}
    >
      <i
        className={clsx(
          'w-3 shrink-0 text-center text-[10px] opacity-70',
          get(componentDefinitions.current, `${match.type}.market.icon`, 'fa-regular fa-square')
        )}
      />
      <span className="min-w-0 grow basis-0 truncate text-xs">
        {match.id}
        {match.label && <span className="opacity-50"> · {match.label}</span>}
      </span>
      {rootLabel && <span className="shrink-0 truncate text-[10px] opacity-60">{rootLabel}</span>}
    </button>
  );
};

export default ElementMatchItem;
