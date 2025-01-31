// Packages
import React from 'react';
import noop from 'lodash/noop';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';

/**
 * @param {{
 *   content?: string;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const { content = 'Markdown', onUpdate = noop } = props;

  const handleChange = key => e => onUpdate(key, e.target.value);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Markdown Settings</h1>
      </div>
      <div className="flex flex-col p-2 h-full">
        <div className="flex flex-col h-full">
          <label>Content</label>
          <TextArea
            value={content}
            classNameContainer="h-full"
            className="rounded-sm h-full"
            onChange={handleChange('content')}
          />
        </div>
      </div>
    </div>
  );
};

export default Settings;
