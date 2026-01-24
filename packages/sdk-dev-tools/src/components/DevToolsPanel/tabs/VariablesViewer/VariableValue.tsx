import clsx from 'clsx';

export type VariableValueProps = {
  className?: string;
  type?: string;
  preffix?: string;
  value?: string;
};

const VariableValue = ({ className, type, preffix, value }: VariableValueProps) => (
  <div className={clsx('flex items-center gap-1', className)}>
    {preffix}
    {type === 'color' && (
      <div
        className="min-h-4 min-w-4 rounded-sm border border-gray-300"
        title={value}
        style={{ backgroundColor: value }}
      />
    )}
    <div className={clsx('truncate', { uppercase: type === 'color' && value?.includes('#') })} title={value}>
      {value}
    </div>
  </div>
);

export default VariableValue;
