import Input from '@plitzi/plitzi-ui/Input';
import { useCallback } from 'react';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OptionInputProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue>) => void;
};

const OptionInput = ({ value, onChange }: OptionInputProps) => {
  const handleChange = useCallback((value: StyleValue) => onChange?.(value), [onChange]);

  return <Input size="xs" value={value as string} onChange={handleChange} className="min-w-0 w-full" />;
};

export default OptionInput;
