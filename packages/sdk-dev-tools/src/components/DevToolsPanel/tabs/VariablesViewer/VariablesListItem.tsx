// Relatives
import VariableValue from './VariableValue';

export type VariablesListItemProps = {
  name?: string;
  type?: string;
  value?: string;
};

const VariablesListItem = ({ name, type, value }: VariablesListItemProps) => (
  <div className="flex justify-between px-2 py-1 hover:bg-gray-100">
    <div className="flex gap-2 items-center">
      <div className="font-bold">{name}</div>
      <div className="text-sm">({type})</div>
    </div>
    <div className="flex gap-1">
      <VariableValue value={value} type={type} />
    </div>
  </div>
);

export default VariablesListItem;
