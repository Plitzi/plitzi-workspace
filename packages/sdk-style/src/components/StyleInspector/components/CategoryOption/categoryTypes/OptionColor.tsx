import ColorPicker from '@plitzi/plitzi-ui/ColorPicker';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OptionColorProps = {
  className?: string;
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue>) => void;
};

const allowedWords = ['inherit'];

const OptionColor = ({ className, value, onChange }: OptionColorProps) => {
  return (
    <ColorPicker
      size="xs"
      className={{ root: 'w-full min-w-0', input: className }}
      value={value as string}
      onChange={onChange}
      allowVariables
      allowedWords={allowedWords}
    />
  );
};

export default OptionColor;
