import clsx from 'clsx';

export type VariableValueProps = {
  className?: string;
  type?: string;
  preffix?: string;
  value?: string;
};

const VariableValue = ({ className, type, preffix, value }: VariableValueProps) => {
  return (
    <div className={clsx('flex items-center gap-1.5', className)}>
      {preffix && (
        <span className="shrink-0 text-[10px] font-medium tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
          {preffix}
        </span>
      )}
      {type === 'color' && (
        <div
          className="h-3.5 w-3.5 shrink-0 rounded-sm border border-zinc-300 dark:border-zinc-600"
          title={value}
          style={{ backgroundColor: value }}
        />
      )}
      <span
        className={clsx('truncate font-mono', {
          'text-zinc-700 dark:text-zinc-300': type === 'color',
          'text-violet-700 dark:text-violet-300': type !== 'color'
        })}
        title={value}
      >
        {value ?? '—'}
      </span>
    </div>
  );
};

export default VariableValue;
