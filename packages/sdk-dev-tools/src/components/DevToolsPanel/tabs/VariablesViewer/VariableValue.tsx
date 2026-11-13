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
        <span className="text-ui-fg-subtle shrink-0 text-[10px] font-medium tracking-wider uppercase">{preffix}</span>
      )}
      {type === 'color' && (
        <div
          className="border-ui-line-strong h-3.5 w-3.5 shrink-0 rounded-sm border"
          title={value}
          style={{ backgroundColor: value }}
        />
      )}
      <span
        className={clsx('truncate font-mono', {
          'text-ui-fg': type === 'color',
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
