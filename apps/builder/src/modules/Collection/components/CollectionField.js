// Packages
import React from 'react';
import PropTypes from 'prop-types';
// import classNames from 'classnames';
import get from 'lodash/get';
import noop from 'lodash/noop';

// Relatives
import { fieldTypes } from '../CollectionsConstants';
import { emptyObject } from '../../../helpers/utils';

const CollectionField = props => {
  const { name = '', machineName = '', type, params = emptyObject, onRemove = noop } = props;
  const fieldType = get(fieldTypes, type);
  const isRequired = get(params, 'required', false);
  const isPrimary = get(params, 'primary', false);

  return (
    <div className="items-center gap-10 flex py-3 px-10 hover:bg-blue-200/20 hover:cursor-pointer border-b border-gray-300">
      <div className="flex items-center grow basis-0 text-md font-bold">{name !== '' ? name : 'New Field'}</div>
      <div className="flex items-center grow basis-0 text-md">{machineName !== '' ? machineName : 'Not Set'}</div>
      <div className="flex items-center grow basis-0">
        {type && (
          <span className="text-xs">
            <i className={`${fieldType.icon} mr-1`} />
            {fieldType.label}
          </span>
        )}
      </div>
      <div className="flex items-center justify-center w-[100px] text-xl">
        {isRequired && <i className="fa-solid fa-check text-green-400 hover:text-green-500" title="Required" />}
        {!isRequired && <i className="fa-solid fa-xmark text-red-400 hover:text-red-500" title="Not Required" />}
      </div>
      <div className="flex items-center justify-center w-[100px] text-xl">
        {isPrimary && <i className="fa-solid fa-check text-green-400 hover:text-green-500" title="Is Primary" />}
        {!isPrimary && <i className="fa-solid fa-xmark text-red-400 hover:text-red-500" title="Is Not Primary" />}
      </div>
      <div className="flex items-center justify-center w-[150px]">
        <i
          className="fas fa-trash p-1 text-red-400 hover:text-red-500 cursor-pointer"
          title="Remove"
          onClick={onRemove}
        />
      </div>
    </div>
  );
};

CollectionField.propTypes = {
  isNewField: PropTypes.bool,
  name: PropTypes.string,
  machineName: PropTypes.string,
  type: PropTypes.string,
  params: PropTypes.object,
  // Extras
  onRemove: PropTypes.func
};

export default CollectionField;
