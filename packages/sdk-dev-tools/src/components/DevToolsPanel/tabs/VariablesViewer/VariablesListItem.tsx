import VariableValue from './VariableValue';

import type { StyleThemeMode, StyleVariableValue } from '@plitzi/sdk-shared';

export type VariablesListItemProps = {
  name?: string;
  type?: string;
  value?: StyleVariableValue;
};

const VariablesListItem = ({ name, type, value = '' }: VariablesListItemProps) => (
  <div className="flex border-gray-300 px-2 py-1 not-first:border-t hover:bg-gray-100">
    <div className="flex grow basis-0 items-center gap-2">
      <div className="font-bold">{name}</div>
      <div className="text-sm">({type})</div>
    </div>
    <div className="flex grow basis-0 items-center gap-4">
      {(typeof value === 'string' || typeof value === 'number') && (
        <VariableValue type={type} value={value as string} />
      )}
      {typeof value === 'object' &&
        Object.keys(value).map((valueKey, i) => (
          <VariableValue
            key={i}
            className="min-w-40"
            type={type}
            preffix={`${valueKey}:`}
            value={value[valueKey as Exclude<StyleThemeMode, 'system'> | 'default']}
          />
        ))}
    </div>
  </div>
);

export default VariablesListItem;
