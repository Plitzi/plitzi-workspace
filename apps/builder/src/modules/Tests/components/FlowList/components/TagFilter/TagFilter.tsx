import clsx from 'clsx';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export type TagFilterProps = {
  /** Every tag the journeys carry, with how many carry it. */
  tags: readonly { tag: string; count: number }[];
  /** The tag chosen — none: every journey. */
  tag?: string;
  onTag: (tag: string | undefined) => void;
};

const CHIP = 'flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium';
const ON = 'border-primary-400 bg-primary-50 text-primary-700 dark:bg-primary-400/10 dark:text-primary-200';
const OFF =
  'border-gray-300 text-zinc-600 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800';

/**
 * The journeys' tags as chips, one row of them however many there are: what does not fit waits behind "+N", which
 * opens the rest below — a few rows at most, scrolled as any list is. Never sideways: a mouse has no good way to.
 * The tag chosen comes first, so it is never one of those hidden.
 */
const TagFilter = ({ tags, tag, onTag }: TagFilterProps) => {
  const chips = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(0);
  const [row, setRow] = useState<number>();
  const ordered = tag ? [...tags.filter(each => each.tag === tag), ...tags.filter(each => each.tag !== tag)] : tags;

  // How many chips fall below the first row: what "+N" counts while the row is closed.
  const measure = useCallback(() => {
    const node = chips.current;
    const first = node?.firstElementChild;
    if (!node || !(first instanceof HTMLElement)) {
      return;
    }

    setRow(first.offsetHeight);
    setHidden(
      [...node.children].filter(child => child instanceof HTMLElement && child.offsetTop > first.offsetTop).length
    );
  }, []);

  useLayoutEffect(() => {
    const node = chips.current;
    if (!node) {
      return;
    }

    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(node);

    return () => resized.disconnect();
  }, [measure, ordered.length, tag]);

  return (
    <div className="flex shrink-0 items-start gap-1.5">
      <div
        ref={chips}
        role="group"
        aria-label="Filter by tag"
        className={clsx('flex min-w-0 grow flex-wrap gap-1.5', open ? 'max-h-24 overflow-y-auto' : 'overflow-hidden')}
        style={open || row === undefined ? undefined : { maxHeight: row }}
      >
        <button
          type="button"
          aria-pressed={!tag}
          className={clsx(CHIP, tag ? OFF : ON)}
          onClick={() => onTag(undefined)}
        >
          All
        </button>
        {ordered.map(each => (
          <button
            key={each.tag}
            type="button"
            aria-pressed={tag === each.tag}
            className={clsx(CHIP, tag === each.tag ? ON : OFF)}
            onClick={() => onTag(tag === each.tag ? undefined : each.tag)}
          >
            {each.tag}
            <span className="text-zinc-400 tabular-nums dark:text-zinc-500">{each.count}</span>
          </button>
        ))}
      </div>
      {(open || hidden > 0) && (
        <button
          type="button"
          aria-expanded={open}
          className={clsx(CHIP, OFF)}
          title={open ? 'Show one row of tags' : `${String(hidden)} more tags`}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Less' : `+${String(hidden)}`}
        </button>
      )}
    </div>
  );
};

export default TagFilter;
