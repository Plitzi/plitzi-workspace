// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';
import Select from '@plitzi/plitzi-ui-components/Select';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';

/**
 * @param {{
 *   content?: string;
 *   contentPlacement?: 'before' | 'after' | 'elements';
 *   subType?: 'button' | 'reset' | 'submit';
 *   disabled?: boolean;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const {
    content = 'Button',
    contentPlacement = 'after',
    subType = 'button',
    disabled = false,
    onUpdate = noop
  } = props;

  const handleChangeContent = useCallback(e => onUpdate('content', e.target.value), [onUpdate]);

  const handleChangeContentPlacement = useCallback(e => onUpdate('contentPlacement', e.target.value), [onUpdate]);

  const handleChangeSubType = useCallback(e => onUpdate('subType', e.target.value), [onUpdate]);

  const handleChangeDisabled = useCallback(e => onUpdate('disabled', e.target.checked), [onUpdate]);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Button Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Content</label>
          <Input value={content} onChange={handleChangeContent} inputClassName="rounded-sm" />
        </div>
        <div className="flex flex-col mt-4">
          <label>Mode</label>
          <Select value={contentPlacement} onChange={handleChangeContentPlacement} className="rounded-sm">
            <option value="before">Before Elements</option>
            <option value="after">After Elements</option>
            <option value="elements">Only Elements</option>
          </Select>
        </div>
        <div className="flex flex-col mt-4">
          <label>Button Type</label>
          <Select value={subType} onChange={handleChangeSubType} className="rounded-sm">
            <option value="button">Button</option>
            <option value="submit">Submit</option>
            <option value="reset">Reset</option>
          </Select>
        </div>
        <div className="flex items-center mt-4">
          <Checkbox id="disabled" checked={disabled} onChange={handleChangeDisabled} className="rounded-sm mr-2" />
          <label htmlFor="disabled" className="cursor-pointer select-none">
            Is Disabled
          </label>
        </div>
      </div>
    </div>
  );
};

export default Settings;
