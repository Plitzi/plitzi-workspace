import { get } from '@plitzi/plitzi-ui/helpers';
import Icon from '@plitzi/plitzi-ui/Icon';

import { fieldTypes } from '../CollectionsConstants';

export type CollectionFieldProps = {
  isNewField?: boolean;
  name?: string;
  machineName?: string;
  type?: keyof typeof fieldTypes;
  params?: object;
  onRemove?: () => void;
};

const CollectionField = ({ name = '', machineName = '', type, params, onRemove }: CollectionFieldProps) => {
  const fieldType = get(fieldTypes, type ?? ('' as keyof typeof fieldTypes));
  const isRequired = get(params, 'required', false) as boolean;
  const isPrimary = get(params, 'primary', false) as boolean;

  return (
    <div className="flex items-center gap-10 border-b border-gray-300 pb-2 hover:cursor-pointer hover:bg-blue-200/20">
      <div className="text-md flex grow basis-0 items-center font-bold">{name !== '' ? name : 'New Field'}</div>
      <div className="text-md flex grow basis-0 items-center">{machineName !== '' ? machineName : 'Not Set'}</div>
      <div className="flex grow basis-0 items-center">
        {type && (
          <span className="text-xs">
            <i className={`${fieldType.icon} mr-1`} />
            {fieldType.label}
          </span>
        )}
      </div>
      <div className="flex w-25 items-center justify-center text-xl">
        {isRequired && <i className="fa-solid fa-check text-green-400 hover:text-green-500" title="Required" />}
        {!isRequired && <i className="fa-solid fa-xmark text-red-400 hover:text-red-500" title="Not Required" />}
      </div>
      <div className="flex w-25 items-center justify-center text-xl">
        {isPrimary && <i className="fa-solid fa-check text-green-400 hover:text-green-500" title="Is Primary" />}
        {!isPrimary && <i className="fa-solid fa-xmark text-red-400 hover:text-red-500" title="Is Not Primary" />}
      </div>
      <div className="flex w-37.5 items-center justify-center">
        <Icon icon="fas fa-trash" intent="danger" className="cursor-pointer p-1" title="Remove" onClick={onRemove} />
      </div>
    </div>
  );
};

export default CollectionField;
