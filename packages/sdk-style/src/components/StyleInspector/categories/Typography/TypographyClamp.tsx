import { useCallback } from 'react';

import CategoryOption from '../../components/CategoryOption';

import type { StyleCategory, StyleObject, StyleValue } from '@plitzi/sdk-shared';

const clampKeys = ['line-clamp', '-webkit-line-clamp', '-webkit-box-orient'] as StyleCategory[];

export type TypographyClampProps = {
  value?: StyleValue;
  onChange?: (values: StyleObject) => void;
};

const TypographyClamp = ({ value, onChange }: TypographyClampProps) => {
  const handleChange = useCallback(
    (newValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      const lines = typeof newValue === 'string' || typeof newValue === 'number' ? String(newValue).trim() : '';
      if (!lines) {
        onChange?.({ 'line-clamp': undefined, '-webkit-line-clamp': undefined, '-webkit-box-orient': undefined });

        return;
      }

      // Truncation only takes effect on a -webkit-box, so the display and the box orientation travel with the count;
      // the standard `line-clamp` rides along for engines that already dropped the prefixed pair.
      onChange?.({
        display: '-webkit-box',
        'line-clamp': lines,
        '-webkit-line-clamp': lines,
        '-webkit-box-orient': 'vertical'
      });
    },
    [onChange]
  );

  return <CategoryOption keys={clampKeys} label="Line Clamp" value={value} onChange={handleChange} />;
};

export default TypographyClamp;
