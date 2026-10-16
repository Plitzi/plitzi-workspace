export type VariableValueProps = {
  className?: string;
  value?: string;
  type?: string;
};

const VariableValue = ({ type, value }: VariableValueProps) => {
  return (
    <div className="flex items-center gap-1 truncate text-xs">
      {type === 'color' && (
        <div
          className="min-h-3 min-w-3 rounded-sm border border-gray-300"
          title={value}
          style={{ backgroundColor: value }}
        />
      )}
      <div className="truncate" title={value}>
        {value}
      </div>
    </div>
  );
};

export default VariableValue;
