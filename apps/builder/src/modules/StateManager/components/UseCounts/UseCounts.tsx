import clsx from 'clsx';

export type UseCountsProps = {
  reads: string[];
  writes: string[];
  /** Given, the counts are a button: what shows the elements behind them. */
  onClick?: () => void;
};

/** How many elements read a path, or anything under it, and how many write it. */
const UseCounts = ({ reads, writes, onClick }: UseCountsProps) => {
  const title = `${String(reads.length)} element${reads.length === 1 ? '' : 's'} read it, ${String(writes.length)} write it`;
  const counts = (
    <>
      {reads.length}
      <span className="text-ui-line-strong mx-0.5">/</span>
      {writes.length}
    </>
  );
  const className = 'text-ui-fg-subtle text-right text-[11px] whitespace-nowrap tabular-nums';

  if (!onClick) {
    return (
      <span className={className} title={title}>
        {counts}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={clsx(className, 'hover:bg-ui-hover hover:text-ui-fg cursor-pointer rounded-sm px-1')}
      title={`${title} — show them`}
      onClick={onClick}
    >
      {counts}
    </button>
  );
};

export default UseCounts;
