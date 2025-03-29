import Select from '@plitzi/plitzi-ui/Select';
import classNames from 'classnames';

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
    <Select size="xs" value={value as string} onChange={onChange} className={classNames('min-w-0 w-full', className)}>
      {children}
    </Select>
  );
};

export default OptionSelect;
