// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';
import Select from '@plitzi/plitzi-ui-components/Select';
import { TextArea } from '@plitzi/plitzi-ui-components';

const optionsDefault = [];

const Settings = props => {
  const {
    subType = 'text',
    name = '',
    label = 'Label',
    placeholder = '',
    autoComplete = true,
    options = optionsDefault,
    required = true,
    readOnly = false,
    disabled = false,
    onUpdate = noop
  } = props;

  const handleChangeName = useCallback(e => onUpdate('name', e.target.value), [onUpdate]);

  const handleChangeLabel = useCallback(e => onUpdate('label', e.target.value), [onUpdate]);

  const handleChangePlaceholder = useCallback(e => onUpdate('placeholder', e.target.value), [onUpdate]);

  const handleChangeType = useCallback(e => onUpdate('subType', e.target.value), [onUpdate]);

  const handleChangeAutoComplete = useCallback(e => onUpdate('autoComplete', e.target.checked), [onUpdate]);

  const handleChangeRequired = useCallback(e => onUpdate('required', e.target.checked), [onUpdate]);

  const handleChangeReadOnly = useCallback(e => onUpdate('readOnly', e.target.checked), [onUpdate]);

  const handleChangeDisabled = useCallback(e => onUpdate('disabled', e.target.checked), [onUpdate]);

  const handleChangeOptions = useCallback(
    e => {
      if (!e.target.value) {
        onUpdate('options', []);

        return;
      }

      onUpdate('options', e.target.value.split('\n'));
    },
    [onUpdate]
  );

  // const handleChangeValue = useCallback(e => {}, [value, subType]);

  const optionsString = useMemo(() => (Array.isArray(options) ? options.join('\n') : ''), [options]);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Form Input Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Input Name</label>
          <Input value={name} onChange={handleChangeName} inputClassName="rounded" />
        </div>
        <div className="flex flex-col mt-4">
          <label>Label</label>
          <Input value={label} onChange={handleChangeLabel} inputClassName="rounded" />
        </div>
        <div className="flex flex-col mt-4">
          <label>Placeholder</label>
          <Input value={placeholder} onChange={handleChangePlaceholder} inputClassName="rounded" />
        </div>
        <div className="flex flex-col mt-4">
          <label>Input Type</label>
          <Select value={subType} onChange={handleChangeType} className="rounded">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="time">Time</option>
            <option value="email">Email</option>
            <option value="password">Password</option>
            <option value="select">Select</option>
            <option value="checkbox">Checkbox</option>
            <option value="textarea">Long Text</option>
            <option value="hidden">Hidden</option>
            {/* <option value="color">Color</option> */}
            {/* <option value="switch">Switch</option> */}
          </Select>
        </div>
        {/* <div className="flex flex-col mt-4">
          <label>Value</label>
          <Input value={value} onChange={handleChangeValue} />
        </div> */}
        {subType === 'text' && (
          <div className="flex flex-col mt-4">
            <label>Auto Complete</label>
            <Checkbox checked={autoComplete} onChange={handleChangeAutoComplete} />
          </div>
        )}
        {(subType === 'text' ||
          subType === 'textarea' ||
          subType === 'number' ||
          subType === 'email' ||
          subType === 'password') && (
          <div className="flex flex-col mt-4">
            <label>Read Only</label>
            <Checkbox checked={readOnly} onChange={handleChangeReadOnly} />
          </div>
        )}
        {subType === 'select' && (
          <div className="flex flex-col mt-4">
            <label>Options</label>
            <TextArea value={optionsString} onChange={handleChangeOptions} />
          </div>
        )}
        <div className="flex flex-col mt-4">
          <label>Required</label>
          <Checkbox checked={required} onChange={handleChangeRequired} />
        </div>
        <div className="flex flex-col mt-4">
          <label>Disabled</label>
          <Checkbox checked={disabled} onChange={handleChangeDisabled} />
        </div>
      </div>
    </div>
  );
};

Settings.propTypes = {
  name: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  label: PropTypes.string,
  placeholder: PropTypes.string,
  subType: PropTypes.oneOf([
    'hidden',
    'text',
    'number',
    'email',
    'time',
    'password',
    'select',
    'checkbox',
    'textarea',
    'color',
    'switch'
  ]),
  options: PropTypes.array,
  autoComplete: PropTypes.bool,
  required: PropTypes.bool,
  readOnly: PropTypes.bool,
  disabled: PropTypes.bool,
  onUpdate: PropTypes.func
};

export default Settings;
