import MetricInput from '@plitzi/plitzi-ui/MetricInput';
import classNames from 'classnames';
import { useCallback } from 'react';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OptionMetricInputProps = {
  className?: string;
  value?: StyleValue;
  units?: { label: string; value: string }[];
  allowedWords?: string[];
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue>) => void;
};

const OptionMetricInput = ({
  value,
  className,
  units = [{ label: 'PX', value: 'px' }],
  allowedWords = [],
  onChange
}: OptionMetricInputProps) => {
  const handleChange = useCallback((value: StyleValue) => onChange?.(value), [onChange]);

  return (
    <MetricInput
      size="xs"
      value={value as string}
      units={units}
      allowedWords={allowedWords}
      onChange={handleChange}
      className={classNames('min-w-0 w-full', className)}
    />
  );
};

export default OptionMetricInput;
