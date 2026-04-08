import VariableValue from './VariableValue';

import type { StyleThemeMode, StyleVariableValue } from '@plitzi/sdk-shared';

export type VariablesListItemProps = {
  name?: string;
  type?: string;
  value?: StyleVariableValue;
};

const VariablesListItem = ({ name, type, value = '' }: VariablesListItemProps) => {
  return (
    <div className="grid grid-cols-[1fr_1.5fr] items-center border-b border-zinc-100 px-3 py-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60">
      {/* Name + type */}
      <div className="flex min-w-0 flex-col gap-0.5 pr-2">
        <span className="truncate font-medium text-zinc-800 dark:text-zinc-200" title={name}>
          {name}
        </span>
        <span className="text-[10px] tracking-wider text-zinc-400 uppercase dark:text-zinc-600">{type}</span>
      </div>

      {/* Value(s) */}
      <div className="flex min-w-0 flex-col gap-0.5">
        {(typeof value === 'string' || typeof value === 'number') && (
          <VariableValue type={type} value={value as string} />
        )}
        {typeof value === 'object' &&
          Object.keys(value).map((valueKey, i) => (
            <VariableValue
              key={i}
              type={type}
              preffix={`${valueKey}:`}
              value={value[valueKey as Exclude<StyleThemeMode, 'system'> | 'default']}
            />
          ))}
      </div>
    </div>
  );
};

export default VariablesListItem;
