import clsx from 'clsx';
import isEmpty from 'lodash-es/isEmpty';
import moment from 'moment';
import { useMemo } from 'react';

import type { CollectionField, CollectionRecord as TCollectionRecord } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type CollectionRecordProps = {
  id?: string;
  values?: TCollectionRecord['values'];
  publishedAt?: number;
  status?: TCollectionRecord['status'];
  fields?: Record<string, CollectionField>;
  onUpdate?: (e: MouseEvent) => void;
  onRemove?: (e: MouseEvent) => void;
};

const CollectionRecord = ({
  id,
  values,
  publishedAt,
  status = 'draft',
  fields,
  onUpdate,
  onRemove
}: CollectionRecordProps) => {
  const publishedAtParsed = useMemo(() => {
    if (!publishedAt) {
      return 'Not Set';
    }

    return moment.utc(publishedAt * 1000).format('MMMM DD, YYYY');
  }, [publishedAt]);

  return (
    <div className="flex items-center gap-4 border-b border-gray-300 px-4 py-3 text-xs last:border-b-0">
      {fields &&
        values &&
        Object.keys(fields).map((fieldKey, i) => {
          const { type } = fields[fieldKey];
          const valueEmpty = isEmpty(values[fieldKey]);

          return (
            <div key={`${id}_${i}`} className="grow basis-0 items-center truncate" title={values[fieldKey] as string}>
              {['text', 'email', 'textarea', 'richText', 'link', 'phone', 'number', 'date'].includes(type) &&
                values[fieldKey]}
              {(type as string) === 'image' && (
                <div
                  className="flex h-12 w-20 items-center justify-center rounded-sm bg-gray-300 bg-cover bg-no-repeat"
                  style={{ backgroundImage: `url(${values[fieldKey]})` }}
                >
                  {valueEmpty && <i className="fas fa-image fa-2x" />}
                </div>
              )}
            </div>
          );
        })}
      <div className="flex w-32 items-start justify-center select-none">
        <div
          className={clsx('rounded-sm border px-4 capitalize', {
            'border-orange-400 text-orange-400': status === 'draft',
            'border-red-400 text-red-400': status === 'archived',
            'border-blue-400 text-blue-400': status === 'published'
          })}
        >
          {status}
        </div>
      </div>
      <div className="flex w-32 items-start">{publishedAtParsed}</div>
      <div className="flex w-20 items-start justify-center text-base">
        {/* <i className="fas fa-ellipsis-v" /> */}
        <i className="fa-solid fa-pencil mr-3 cursor-pointer hover:text-blue-400" title="Update" onClick={onUpdate} />
        <i className="fas fa-trash cursor-pointer text-red-400 hover:text-red-500" title="Remove" onClick={onRemove} />
      </div>
    </div>
  );
};

export default CollectionRecord;
