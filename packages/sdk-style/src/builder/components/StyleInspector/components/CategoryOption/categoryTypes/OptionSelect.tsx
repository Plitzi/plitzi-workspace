import Select from '@plitzi/plitzi-ui/Select';
import clsx from 'clsx';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type OptionSelectProps = {
  className?: string;
  children?: ReactNode;
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue>) => void;
};

const OptionSelect = ({ children, className, value, onChange }: OptionSelectProps) => {
  return (
    <Select size="xs" value={value} onChange={onChange} className={clsx('w-full min-w-0', className)}>
      {children}
    </Select>
  );
};

export default OptionSelect;
