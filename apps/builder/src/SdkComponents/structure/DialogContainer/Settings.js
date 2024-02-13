// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';

const Settings = props => {
  const {
    acceptButtonLabel = 'Accept',
    acceptButtonLabelLoading = 'Loading...',
    rejectButtonLabel = 'Cancel',
    headerLabel = 'Dialog Header',
    autoHideAfterClick = true,
    onUpdate = noop
  } = props;

  const handleChange = key => e => onUpdate(key, e.target.value);

  const handleChangeAutoHide = e => onUpdate('autoHideAfterClick', e.target.checked);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Dialog Container Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Header Label</label>
          <Input value={headerLabel} onChange={handleChange('headerLabel')} inputClassName="rounded" />
        </div>
        <div className="flex flex-col mt-4">
          <label>Accept Label Button</label>
          <Input value={acceptButtonLabel} onChange={handleChange('acceptButtonLabel')} inputClassName="rounded" />
        </div>
        <div className="flex flex-col mt-4">
          <label>Reject Label Button</label>
          <Input value={rejectButtonLabel} onChange={handleChange('rejectButtonLabel')} inputClassName="rounded" />
        </div>
        <div className="flex flex-col mt-4">
          <label>Accept Label Button Loading</label>
          <Input
            value={acceptButtonLabelLoading}
            onChange={handleChange('acceptButtonLabelLoading')}
            inputClassName="rounded"
          />
        </div>
        <div className="flex items-center mt-4">
          <Checkbox
            id="auto-hide-after-click"
            checked={autoHideAfterClick}
            onChange={handleChangeAutoHide}
            className="rounded mr-2"
          />
          <label htmlFor="auto-hide-after-click" className="cursor-pointer select-none">
            Hide after click background
          </label>
        </div>
      </div>
    </div>
  );
};

Settings.propTypes = {
  headerLabel: PropTypes.string,
  acceptButtonLabel: PropTypes.string,
  acceptButtonLabelLoading: PropTypes.string,
  rejectButtonLabel: PropTypes.string,
  autoHideAfterClick: PropTypes.bool,
  onUpdate: PropTypes.func
};

export default Settings;
