import clsx from 'clsx';

export type AreaStat = {
  value: string;
  /** What it is out of, when it is a count of a whole: `/3`. */
  of?: string;
  label: string;
  tone?: 'good' | 'bad';
};

/** The tests in a few numbers, large, across the width: flows passing, steps played, element checks, the last play. */
const AreaStats = ({ stats }: { stats: AreaStat[] }) => (
  <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
    {stats.map(stat => (
      <div
        key={stat.label}
        className="flex flex-col gap-1 rounded-lg border border-gray-300 px-4 py-3 dark:border-zinc-700"
      >
        <span
          className={clsx('text-3xl leading-none font-semibold tracking-tight tabular-nums', {
            'text-emerald-600 dark:text-emerald-400': stat.tone === 'good',
            'text-red-600 dark:text-red-400': stat.tone === 'bad',
            'text-zinc-900 dark:text-zinc-50': stat.tone === undefined
          })}
        >
          {stat.value}
          {stat.of && <span className="text-base font-normal text-zinc-400 dark:text-zinc-500">{stat.of}</span>}
        </span>
        <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          {stat.label}
        </span>
      </div>
    ))}
  </div>
);

export default AreaStats;
