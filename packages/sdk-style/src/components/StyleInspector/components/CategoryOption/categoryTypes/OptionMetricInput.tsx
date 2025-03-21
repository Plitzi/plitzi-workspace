import MetricInput from '@plitzi/plitzi-ui/MetricInput';
import { useCallback } from 'react';

import type { StyleValue } from '@plitzi/sdk-shared';

export type OptionMetricInputProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | boolean) => void;
};

const OptionMetricInput = ({ value, onChange }: OptionMetricInputProps) => {
  const handleChange = useCallback((value: StyleValue) => onChange?.(value), [onChange]);

  return (
    <MetricInput
      size="xs"
      value={value as string}
      units={[{ label: 'PX', value: 'px' }]}
      onChange={handleChange}
      className="min-w-0 w-full"
    />
  );
};

export default OptionMetricInput;
