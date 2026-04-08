import clsx from 'clsx';

import VariableValue from './VariableValue';
import { useDevToolsTheme } from '../../../../DevToolsThemeContext';

import type { StyleThemeMode, StyleVariableValue } from '@plitzi/sdk-shared';

export type VariablesListItemProps = {
  name?: string;
  type?: string;
  value?: StyleVariableValue;
};

const VariablesListItem = ({ name, type, value = '' }: VariablesListItemProps) => {
  const { isDark } = useDevToolsTheme();

  return (
    <div
      className={clsx(
        'grid items-center border-b px-3 py-1.5 transition-colors',
        'grid-cols-[1fr_1.5fr]',
        isDark ? 'border-zinc-800 hover:bg-zinc-800/60' : 'border-zinc-100 hover:bg-zinc-50'
      )}
    >
      {/* Name + type */}
      <div className="flex min-w-0 flex-col gap-0.5 pr-2">
        <span className={clsx('truncate font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')} title={name}>
          {name}
        </span>
        <span className={clsx('text-[10px] tracking-wider uppercase', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
          {type}
        </span>
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
