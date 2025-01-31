// Packages
import React, { useCallback, useState } from 'react';
import get from 'lodash/get';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';
import Heading from '@plitzi/plitzi-ui-components/Heading';

/**
 * @param {{
 *   sources: object;
 *   source: string;
 *   onCancel: () => void;
 *   onNext: (values: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const StepSource = props => {
  const { sources, source: sourceProp = '', onCancel = noop, onNext = noop } = props;
  const [source, setSource] = useState(() => {
    if (!sourceProp) {
      return get(Object.keys(sources), '0', '');
    }

    return sourceProp;
  });

  const handleClickSource = category => () => setSource(category);

  const handleClickCancel = useCallback(() => onCancel(), [onCancel]);

  const handleClickNext = useCallback(() => onNext({ source }), [onNext, source]);

  return (
    <div className="flex flex-col">
      <Heading type="h5" className="mb-4">
        Sources
      </Heading>
      <div className="flex flex-col">
        {sources &&
          Object.keys(sources).map((srcKey, i) => {
            const name = get(sources, `${srcKey}.name`, '');

            return (
              <div
                key={i}
                className="group w-full hover:bg-blue-400 border rounded-sm flex px-2 py-1 items-center cursor-pointer overflow-hidden [&:not(:first-child)]:mt-2 select-none"
                title={name}
                onClick={handleClickSource(srcKey)}
              >
                <i className="fas fa-database text-blue-400 group-hover:text-white" />
                <div className="truncate text-xs w-full px-1 group-hover:text-white">{name}</div>
                {source === srcKey && (
                  <i className="fa-solid fa-check text-blue-400 group-hover:text-white" title="Selected" />
                )}
              </div>
            );
          })}
      </div>
      <div className="flex justify-between mt-4">
        <Button onClick={handleClickCancel} className="mr-4 rounded-md text-xs">
          Cancel
        </Button>
        <Button onClick={handleClickNext} className="rounded-md text-xs">
          Next
        </Button>
      </div>
    </div>
  );
};

export default StepSource;
