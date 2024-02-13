// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';

const Settings = props => {
  const { content = 'Text', onUpdate = noop } = props;

  const handleChange = key => e => onUpdate(key, e.target.value);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Text Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Content</label>
          <TextArea value={content} className="rounded" onChange={handleChange('content')} />
        </div>
      </div>
    </div>
  );
};

Settings.propTypes = {
  content: PropTypes.string,
  onUpdate: PropTypes.func
};

export default Settings;
