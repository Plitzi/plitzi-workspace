// Packages
import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';
import Heading from '@plitzi/plitzi-ui-components/Heading';

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
          Object.keys(sources).map((srcKey, i) => (
            <div
              key={i}
              className="group w-full hover:bg-blue-400 border rounded flex px-2 py-1 items-center cursor-pointer overflow-hidden not-first:mt-2 select-none"
              title={sources[srcKey].name}
              onClick={handleClickSource(srcKey)}
            >
              <i className="fas fa-database text-blue-400 group-hover:text-white" />
              <div className="truncate text-xs w-full px-1 group-hover:text-white">{sources[srcKey].name}</div>
              {source === srcKey && (
                <i className="fa-solid fa-check text-blue-400 group-hover:text-white" title="Selected" />
              )}
            </div>
          ))}
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

StepSource.propTypes = {
  className: PropTypes.string,
  sources: PropTypes.object,
  source: PropTypes.string,
  onCancel: PropTypes.func,
  onNext: PropTypes.func
};

export default StepSource;
