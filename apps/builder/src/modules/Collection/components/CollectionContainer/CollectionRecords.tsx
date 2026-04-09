import CollectionRecord from './CollectionRecord';

import type { CollectionField, CollectionRecord as TCollectionRecord } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type CollectionRecordsProps = {
  items?: TCollectionRecord[];
  fields?: Record<string, CollectionField>;
  onUpdate?: (id: string) => (e: MouseEvent) => void;
  onRemove?: (id: string) => (e: MouseEvent) => void;
};

const CollectionRecords = ({ items, fields, onUpdate, onRemove }: CollectionRecordsProps) => (
  <div className="flex grow flex-col rounded-sm border border-gray-300 dark:border-zinc-700">
    <div className="flex h-10 items-center gap-4 border-b border-gray-300 px-4 py-3 font-bold dark:border-zinc-700">
      {fields &&
        Object.keys(fields).map((fieldKey, i) => (
          <div className="grow basis-0 items-center" key={i}>
            {fields[fieldKey].name}
          </div>
        ))}
      <div className="flex w-32 justify-center">Status</div>
      <div className="flex w-32">Published On</div>
      <div className="flex w-20 items-center justify-center">Actions</div>
    </div>
    <div className="flex grow basis-0 flex-col">
      {items &&
        items.map((item, i) => (
          <CollectionRecord
            key={i}
            {...item}
            fields={fields}
            onUpdate={onUpdate?.(item.id)}
            onRemove={onRemove?.(item.id)}
          />
        ))}
    </div>
  </div>
);

export default CollectionRecords;
