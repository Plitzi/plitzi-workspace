import clsx from 'clsx';

import { useDevToolsTheme } from '../../../../DevToolsThemeContext';

export type VariableValueProps = {
  className?: string;
  type?: string;
  preffix?: string;
  value?: string;
};

const VariableValue = ({ className, type, preffix, value }: VariableValueProps) => {
  const { isDark } = useDevToolsTheme();

  return (
    <div className={clsx('flex items-center gap-1.5', className)}>
      {preffix && (
        <span
          className={clsx(
            'shrink-0 text-[10px] font-medium tracking-wider uppercase',
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          )}
        >
          {preffix}
        </span>
      )}
      {type === 'color' && (
        <div
          className={clsx('h-3.5 w-3.5 shrink-0 rounded-sm border', isDark ? 'border-zinc-600' : 'border-zinc-300')}
          title={value}
          style={{ backgroundColor: value }}
        />
      )}
      <span
        className={clsx(
          'truncate font-mono',
          type === 'color'
            ? isDark
              ? 'text-zinc-300'
              : 'text-zinc-700'
            : isDark
              ? 'text-violet-300'
              : 'text-violet-700'
        )}
        title={value}
      >
        {value ?? '—'}
      </span>
    </div>
  );
};

export default VariableValue;
