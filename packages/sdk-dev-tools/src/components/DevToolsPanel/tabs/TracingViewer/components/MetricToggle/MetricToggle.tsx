import clsx from 'clsx';
import { useCallback } from 'react';

import type { DurationMetric } from '../../helpers';

const OPTIONS: { id: DurationMetric; label: string; title: string }[] = [
  { id: 'self', label: 'Self', title: 'Own render work — the real per-element cost' },
  { id: 'total', label: 'Total', title: 'Subtree-inclusive time (cascades up the tree)' }
];

export type MetricToggleProps = {
  metric: DurationMetric;
  onChange: (metric: DurationMetric) => void;
  className?: string;
};

const MetricToggle = ({ metric, onChange, className }: MetricToggleProps) => {
  const handleChange = useCallback((next: DurationMetric) => () => onChange(next), [onChange]);

  return (
    <div className={clsx('border-ui-line flex items-center overflow-hidden rounded border', className)}>
      {OPTIONS.map(option => (
        <button
          key={option.id}
          title={option.title}
          aria-pressed={metric === option.id}
          onClick={handleChange(option.id)}
          className={clsx('px-1.5 py-0.5 text-[10px] font-medium', {
            'bg-violet-500 text-white': metric === option.id,
            'text-ui-fg-subtle hover:bg-ui-hover': metric !== option.id
          })}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default MetricToggle;
