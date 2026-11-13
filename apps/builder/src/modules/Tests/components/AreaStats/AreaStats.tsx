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
      <div key={stat.label} className="border-ui-line-strong flex flex-col gap-1 rounded-lg border px-4 py-3">
        <span
          className={clsx('text-3xl leading-none font-semibold tracking-tight tabular-nums', {
            'text-emerald-600 dark:text-emerald-400': stat.tone === 'good',
            'text-red-600 dark:text-red-400': stat.tone === 'bad',
            'text-ui-fg': stat.tone === undefined
          })}
        >
          {stat.value}
          {stat.of && <span className="text-ui-fg-subtle text-base font-normal">{stat.of}</span>}
        </span>
        <span className="text-ui-fg-subtle text-[11px] font-semibold tracking-wider uppercase">{stat.label}</span>
      </div>
    ))}
  </div>
);

export default AreaStats;
