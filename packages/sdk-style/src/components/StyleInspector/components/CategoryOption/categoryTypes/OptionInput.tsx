import Input from '@plitzi/plitzi-ui/Input';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OptionInputProps = {
  className?: string;
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue>) => void;
};

const OptionInput = ({ value, className, onChange }: OptionInputProps) => {
  return (
    <Input
      size="xs"
      value={value as string}
      onChange={onChange}
      className={{ root: 'min-w-0 w-full', input: className }}
    />
  );
};

export default OptionInput;
