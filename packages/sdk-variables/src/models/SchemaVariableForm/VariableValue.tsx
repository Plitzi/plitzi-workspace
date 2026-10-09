import Form from '@plitzi/plitzi-ui/Form';

import VariableSubValueActions from './VariableSubValueActions';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type VariableValueProps = {
  valueType?: SchemaVariable['type'];
  hasSubValues?: boolean;
  name?: string;
  index?: number;
  indexLimit?: number;
  isSubValue?: boolean;
  onClickRemove?: () => void;
  onClickUp?: () => void;
  onClickDown?: () => void;
};

const VariableValue = ({
  valueType = 'text',
  hasSubValues = false,
  name = 'value',
  index,
  indexLimit,
  isSubValue = false,
  onClickRemove,
  onClickUp,
  onClickDown
}: VariableValueProps) => {
  const label = hasSubValues ? 'Fallback Value' : 'Value';
  const field = { name, label, placeholder: label, size: 'xs', className: 'w-full min-w-0' } as const;

  return (
    <div className="flex items-end gap-2">
      {(valueType === 'text' || valueType === 'email' || valueType === 'password' || valueType === 'number') && (
        <Form.Input type={valueType} {...field} />
      )}
      {valueType === 'select' && <Form.Select {...field} />}
      {valueType === 'select2' && <Form.Select2 {...field} />}
      {valueType === 'textarea' && <Form.TextArea {...field} />}
      {valueType === 'switch' && <Form.Switch {...field} />}
      {valueType === 'checkbox' && <Form.Checkbox {...field} />}
      {valueType === 'color' && <Form.Color {...field} />}
      {isSubValue && (
        <VariableSubValueActions
          index={index}
          indexLimit={indexLimit}
          onClickRemove={onClickRemove}
          onClickUp={onClickUp}
          onClickDown={onClickDown}
        />
      )}
    </div>
  );
};

export default VariableValue;
