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
  const placeholder = hasSubValues ? 'Fallback Value' : 'Value';

  return (
    <div className="flex items-end gap-2">
      {['text', 'email', 'password', 'number'].includes(valueType) && (
        <Form.Input
          type={valueType as 'text' | 'email' | 'password' | 'number'}
          name={name}
          label={label}
          placeholder={placeholder}
          size="xs"
          className="w-full"
        />
      )}
      {valueType === 'select' && (
        <Form.Select name={name} label={label} placeholder={placeholder} size="xs" className="w-full" />
      )}
      {valueType === 'select2' && (
        <Form.Select2 name={name} label={label} placeholder={placeholder} size="xs" className="w-full" />
      )}
      {valueType === 'textarea' && (
        <Form.TextArea name={name} label={label} placeholder={placeholder} size="xs" className="w-full" />
      )}
      {valueType === 'switch' && (
        <Form.Switch name={name} label={label} placeholder={placeholder} size="xs" className="w-full" />
      )}
      {valueType === 'checkbox' && (
        <Form.Checkbox name={name} label={label} placeholder={placeholder} size="xs" className="w-full" />
      )}
      {valueType === 'color' && (
        <Form.Color name={name} label={label} placeholder={placeholder} size="xs" className="w-full" />
      )}
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
