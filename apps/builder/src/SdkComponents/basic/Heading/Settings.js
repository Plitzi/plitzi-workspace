// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';
import Select from '@plitzi/plitzi-ui-components/Select';

const Settings = props => {
  const { subType = 'h1', content = '', onUpdate = noop } = props;

  const handleChange = key => e => onUpdate(key, e.target.value);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Heading Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Heading Tag</label>
          <Select value={subType} onChange={handleChange('subType')} className="rounded">
            <option value="h1">H1</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
            <option value="h4">H4</option>
            <option value="h5">H5</option>
            <option value="h6">H6</option>
          </Select>
        </div>
        <div className="flex flex-col mt-4">
          <label>Content</label>
          <TextArea value={content} onChange={handleChange('content')} className="rounded" />
        </div>
      </div>
    </div>
  );
};

Settings.propTypes = {
  content: PropTypes.string,
  subType: PropTypes.oneOf(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
  onUpdate: PropTypes.func
};

export default Settings;
