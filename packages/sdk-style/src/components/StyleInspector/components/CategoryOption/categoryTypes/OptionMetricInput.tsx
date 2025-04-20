import MetricInput from '@plitzi/plitzi-ui/MetricInput';
import classNames from 'classnames';
import { useCallback } from 'react';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OptionMetricInputProps = {
  className?: string;
  value?: StyleValue;
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
  min,
  max,
  step,
  units = [{ label: 'PX', value: 'px' }],
  allowedWords = [],
  onChange
}: OptionMetricInputProps) => {
  const handleChange = useCallback((value: StyleValue) => onChange?.(value), [onChange]);

  return (
    <MetricInput
      size="xs"
      value={value as string}
      min={min}
      max={max}
      step={step}
      units={units}
      allowedWords={allowedWords}
      onChange={handleChange}
      className={classNames('min-w-0 w-full', className)}
    />
  );
};

export default OptionMetricInput;
