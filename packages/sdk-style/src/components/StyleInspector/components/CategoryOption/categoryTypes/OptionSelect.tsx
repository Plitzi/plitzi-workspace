import Select from '@plitzi/plitzi-ui/Select';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type OptionSelectProps = {
  children?: ReactNode;
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue>) => void;
};

const OptionSelect = ({ children, value, onChange }: OptionSelectProps) => {
  return (
    <Select size="xs" value={value as string} onChange={onChange} className="min-w-0 w-full">
      {children}
    </Select>
  );
};

export default OptionSelect;
