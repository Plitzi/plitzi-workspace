import clsx from 'clsx';

import { DURATION_LEGEND } from '../../helpers';

const DurationLegend = () => (
  <div className="flex shrink-0 items-center gap-2 border-t border-zinc-200 px-2 py-1 text-[9px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
    <span className="font-medium">Render budget</span>
    {DURATION_LEGEND.map(item => (
      <span key={item.label} className="flex items-center gap-1">
        <span className={clsx('h-2 w-2 rounded-sm', item.color)} />
        {item.label}
      </span>
    ))}
    <span className="ml-auto">60fps ≈ 16ms · 50ms long task</span>
  </div>
);

export default DurationLegend;
