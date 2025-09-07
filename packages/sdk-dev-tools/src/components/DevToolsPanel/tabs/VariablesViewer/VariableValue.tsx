export type VariableValueProps = {
  value?: string;
  type?: string;
};

const VariableValue = ({ type, value }: VariableValueProps) => (
  <div className="flex gap-1 items-center">
    {type === 'color' && (
      <div className="min-w-2.5 min-h-2.5 rounded-sm" title={value} style={{ backgroundColor: value }} />
    )}
    <div className="truncate" title={value}>
      {value}
    </div>
  </div>
);

export default VariableValue;
