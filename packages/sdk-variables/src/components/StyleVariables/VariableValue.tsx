import { useMemo } from 'react';

import type { StyleThemeValue, StyleVariableValue } from '@plitzi/sdk-shared';

export type VariableValueProps = {
  className?: string;
  value?: StyleVariableValue;
  type?: string;
};

const VariableValue = ({ type, value }: VariableValueProps) => {
  const values = useMemo(
    () => (typeof value === 'object' ? Object.keys(value).sort(a => (a === 'default' ? -1 : 1)) : []),
    [value]
  );

  return (
    <div className="flex items-center gap-2 truncate text-xs">
      {value &&
        type === 'color' &&
        typeof value === 'object' &&
        values.map(valueKey => (
          <div key={valueKey} className="flex items-center gap-1 capitalize" title={valueKey}>
            {valueKey[0]}:
            <div
              className="min-h-3 min-w-3 rounded-xs border border-gray-300"
              style={{ backgroundColor: value[valueKey as keyof StyleThemeValue] }}
            />
          </div>
        ))}
      {type === 'text' && (typeof value === 'string' || typeof value === 'number') && (
        <div className="truncate" title={value as string}>
          {value}
        </div>
      )}
    </div>
  );
};

export default VariableValue;
