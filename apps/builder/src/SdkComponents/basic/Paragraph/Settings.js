// Packages
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';

const Settings = props => {
  const { content = 'Paragraph', onUpdate = noop } = props;

  const handleChangeContent = useCallback(e => onUpdate('content', e.target.value), [onUpdate]);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Paragraph Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Content</label>
          <TextArea value={content} className="rounded" onChange={handleChangeContent} />
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
