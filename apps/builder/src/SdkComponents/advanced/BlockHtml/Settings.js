// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop';

// Alias
import ElementAdvancedEditor from '@pmodules/Elements/ElementAdvancedEditor';

/**
 * @param {{
 *   content?: string;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
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

export default Settings;
