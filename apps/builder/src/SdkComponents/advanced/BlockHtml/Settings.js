// Packages
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import ElementAdvancedEditor from '@pmodules/Elements/ElementAdvancedEditor';

const Settings = props => {
  const { content = '', onUpdate = noop } = props;

  const handleChangeContent = useCallback(value => onUpdate('content', value), [onUpdate]);

  return (
    <div className="flex flex-col grow">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Block Html Settings</h1>
      </div>
      <ElementAdvancedEditor className="grow" value={content} mode="html" onChange={handleChangeContent} />
    </div>
  );
};

Settings.propTypes = {
  content: PropTypes.string,
  onUpdate: PropTypes.func
};

export default Settings;
