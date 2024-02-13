// Packages
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Select from '@plitzi/plitzi-ui-components/Select';
import Input from '@plitzi/plitzi-ui-components/Input';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';

const Settings = props => {
  const { method = 'get', managedByInteractions = false, actionUrl = '', onUpdate = noop } = props;

  const handleChangeActionUrl = useCallback(e => onUpdate('actionUrl', e.target.value), [onUpdate]);

  const handleChangeMethod = useCallback(e => onUpdate('method', e.target.value), [onUpdate]);

  const handleChangeManageByInteractions = useCallback(
    e => onUpdate('managedByInteractions', e.target.checked),
    [onUpdate]
  );

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Form Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Form Method</label>
          <Select value={method} onChange={handleChangeMethod} className="rounded">
            <option value="get">GET</option>
            <option value="post">POST</option>
          </Select>
        </div>
        <div className="flex flex-col mt-4">
          <label>Action URL</label>
          <Input value={actionUrl} onChange={handleChangeActionUrl} inputClassName="rounded" />
        </div>
        <div className="flex items-center mt-4">
          <Checkbox
            id="managed-by-interactions"
            checked={managedByInteractions}
            onChange={handleChangeManageByInteractions}
            className="rounded mr-2"
          />
          <label htmlFor="managed-by-interactions" className="cursor-pointer select-none">
            Managed By Interactions
          </label>
        </div>
      </div>
    </div>
  );
};

Settings.propTypes = {
  method: PropTypes.oneOf(['get', 'post']),
  actionUrl: PropTypes.string,
  managedByInteractions: PropTypes.bool,
  onUpdate: PropTypes.func
};

export default Settings;
