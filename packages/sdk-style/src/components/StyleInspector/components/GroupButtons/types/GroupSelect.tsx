import Select from '@plitzi/plitzi-ui/Select';

import type { ReactNode } from 'react';

export type GroupSelectProps = {
  children?: ReactNode;
  value?: string | number;
  onChange?: (value: string) => void;
};

const GroupSelect = ({ children, value = '', onChange, ...otherProps }: GroupSelectProps) => {
  return (
    <Select
      className="rounded-md basis-0 grow border-0 rounded-none text-xs px-2 py-0 m-0"
      value={value}
      size="custom"
      onChange={onChange}
      {...otherProps}
    >
      {children}
    </Select>
  );
};

export default GroupSelect;
