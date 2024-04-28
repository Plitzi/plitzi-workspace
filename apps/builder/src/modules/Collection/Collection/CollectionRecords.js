// Packages
import React from 'react';
import noop from 'lodash/noop';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import CollectionRecord from './CollectionRecord';

const itemsDefault = [];

/**
 * @param {{
 *   items?: any[];
 *   fields?: object;
 *   onUpdate?: () => void;
 *   onRemove?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const CollectionRecords = ({ items = itemsDefault, fields = emptyObject, onUpdate = noop, onRemove = noop }) => (
  <div className="flex flex-col grow border border-gray-300 rounded">
    <div className="flex border-b border-gray-300 h-10 font-bold items-center py-3 px-4 gap-4">
      {fields &&
        Object.keys(fields).map((fieldKey, i) => (
          <div className="items-center grow basis-0" key={i}>
            {fields[fieldKey]?.name}
          </div>
        ))}
      <div className="flex w-32 justify-center">Status</div>
      <div className="flex w-32">Published On</div>
      <div className="flex w-20 items-center justify-center">Actions</div>
    </div>
    <div className="flex flex-col basis-0 grow">
      {items &&
        items.map((item, i) => (
          <CollectionRecord
            key={i}
            {...item}
            fields={fields}
            onUpdate={onUpdate(item.id)}
            onRemove={onRemove(item.id)}
          />
        ))}
    </div>
  </div>
);

export default CollectionRecords;
