import MetricInput from '@plitzi/plitzi-ui/MetricInput';
import clsx from 'clsx';
import { useCallback } from 'react';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OptionMetricInputProps = {
  className?: string;
  value?: StyleValue;
  preffix?: string;
  min?: number;
  max?: number;
  step?: number;
  units?: { label: string; value: string }[];
  allowedWords?: string[];
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue>) => void;
};

const OptionMetricInput = ({
  value,
  className,
  preffix = '',
  min,
  max,
  step,
  units = [
    { label: 'PX', value: 'px' },
    { label: 'VW', value: 'vw' },
    { label: 'VH', value: 'vh' },
    { label: '%', value: '%' },
    { label: 'EM', value: 'em' },
    { label: 'REM', value: 'rem' },
    { label: 'DVH', value: 'dvh' },
    { label: 'DVW', value: 'dvw' },
    { label: 'LVH', value: 'lvh' },
    { label: 'LVW', value: 'lvw' }
  ],
  allowedWords = ['auto', 'none'],
  onChange
}: OptionMetricInputProps) => {
  const handleChange = useCallback((value: StyleValue) => onChange?.(value), [onChange]);

  return (
    <div className="flex items-center gap-1">
      {preffix && <span className="text-xs">{preffix}:</span>}
      <MetricInput
        size="xs"
        value={value as string}
        min={min}
        max={max}
        step={step}
        units={units}
        allowedWords={allowedWords}
        onChange={handleChange}
        className={clsx('w-full min-w-0', className)}
      />
    </div>
  );
};

export default OptionMetricInput;
