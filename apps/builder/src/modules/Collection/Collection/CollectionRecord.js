// Packages
import React, { useMemo } from 'react';
import noop from 'lodash/noop';
import moment from 'moment';
import classNames from 'classnames';
import isEmpty from 'lodash/isEmpty';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

/**
 * @param {{
 *   id?: string;
 *   values?: object;
 *   publishedAt?: number;
 *   status?: string;
 *   fields?: object;
 *   onUpdate?: () => void;
 *   onRemove?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const CollectionRecord = props => {
  const {
    id,
    values = emptyObject,
    publishedAt,
    status = 'draft',
    fields = emptyObject,
    onUpdate = noop,
    onRemove = noop
  } = props;
  const publishedAtParsed = useMemo(() => {
    if (!publishedAt) {
      return 'Not Set';
    }

    return moment(publishedAt).format('MMMM DD, YYYY');
  }, [publishedAt]);

  return (
    <div className="flex items-center border-b border-gray-300 last:border-b-0 py-3 px-4 gap-4 text-xs">
      {fields &&
        Object.keys(fields).map((fieldKey, i) => {
          const { type } = fields[fieldKey];
          const valueEmpty = isEmpty(values[fieldKey]);

          return (
            <div key={`${id}_${i}`} className="items-center grow basis-0 truncate" title={values[fieldKey]}>
              {['text', 'email', 'textarea', 'richText', 'link', 'phone', 'number', 'date'].includes(type) &&
                values[fieldKey]}
              {type === 'image' && (
                <div
                  className="h-12 w-20 flex items-center bg-cover justify-center bg-gray-300 bg-no-repeat rounded"
                  style={{ backgroundImage: `url(${values[fieldKey]})` }}
                >
                  {valueEmpty && <i className="fas fa-image fa-2x" />}
                </div>
              )}
            </div>
          );
        })}
      <div className="flex justify-center items-start w-32 select-none">
        <div
          className={classNames('px-4 border rounded capitalize', {
            'text-orange-400 border-orange-400': status === 'draft',
            'text-red-400 border-red-400': status === 'archived',
            'text-blue-400 border-blue-400': status === 'published'
          })}
        >
          {status}
        </div>
      </div>
      <div className="flex w-32 items-start">{publishedAtParsed}</div>
      <div className="flex w-20 items-start justify-center text-base">
        {/* <i className="fas fa-ellipsis-v" /> */}
        <i className="fa-solid fa-pencil mr-3 hover:text-blue-400 cursor-pointer" title="Update" onClick={onUpdate} />
        <i className="fas fa-trash text-red-400 hover:text-red-500 cursor-pointer" title="Remove" onClick={onRemove} />
      </div>
    </div>
  );
};

export default CollectionRecord;
