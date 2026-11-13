import clsx from 'clsx';

import { BUBBLED_COLOR, DURATION_LEGEND } from '../../helpers';

const DurationLegend = () => (
  <div className="border-ui-line text-ui-fg-subtle flex shrink-0 items-center gap-2 overflow-x-auto border-t px-2 py-1 text-[9px]">
    <span className="font-medium">Render budget</span>
    {DURATION_LEGEND.map(item => (
      <span key={item.label} className="flex shrink-0 items-center gap-1">
        <span className={clsx('h-2 w-2 rounded-sm', item.color)} />
        {item.label}
      </span>
    ))}
    <span className="flex shrink-0 items-center gap-1">
      <span className={clsx('h-2 w-2 rounded-sm', BUBBLED_COLOR)} />
      subtree only
    </span>
    <span className="flex shrink-0 items-center gap-1">
      <span
        className="border-ui-line-strong/60 bg-ui-raised h-2 w-2 rounded-sm border"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(113,113,122,0.4) 0, rgba(113,113,122,0.4) 1px, transparent 1px, transparent 3px)'
        }}
      />
      no render
    </span>
    <span className="flex shrink-0 items-center gap-1">
      <span className="h-2 w-2 rounded-sm bg-violet-600" />
      selected
    </span>
    <span className="ml-auto shrink-0">60fps ≈ 16ms · 50ms long task</span>
  </div>
);

export default DurationLegend;
