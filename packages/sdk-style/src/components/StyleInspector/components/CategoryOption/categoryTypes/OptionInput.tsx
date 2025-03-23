import Input from '@plitzi/plitzi-ui/Input';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OptionInputProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue>) => void;
};

const OptionInput = ({ value, onChange }: OptionInputProps) => {
  return <Input size="xs" value={value as string} onChange={onChange} className="min-w-0 w-full" />;
};

export default OptionInput;
