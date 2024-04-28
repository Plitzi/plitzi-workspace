// Packages
import React, { use } from 'react';
import { usePlitziServiceContext } from '@plitzi/plitzi-sdk';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';
import Select from '@plitzi/plitzi-ui-components/Select';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';

/**
 * @param {{
 *   source?: string;
 *   query?: string;
 *   limit?: string;
 *   singleRecord?: boolean;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const { source = '', query = '', limit = '10', singleRecord = false, onUpdate = noop } = props;
  const {
    contexts: { CollectionContext }
  } = usePlitziServiceContext();
  const { collections } = use(CollectionContext);

  const handleChange = key => e => onUpdate(key, e.target.value);

  const handleChangeIsPlugin = key => e => onUpdate(key, e.target.checked);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Collection Container Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Source</label>
          <Select value={source} onChange={handleChange('source')} className="rounded">
            <option value="">Select a Source</option>
            {Object.values(collections).map((collection, i) => (
              <option key={i} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col mt-4">
          <label>Query</label>
          <TextArea value={query} onChange={handleChange('query')} className="rounded" />
        </div>
        <div className="flex items-center mt-4">
          <Checkbox
            id="single-record"
            checked={singleRecord}
            onChange={handleChangeIsPlugin('singleRecord')}
            className="rounded mr-2"
          />
          <label htmlFor="single-record" className="cursor-pointer select-none">
            Single Record
          </label>
        </div>
        {!singleRecord && (
          <div className="flex flex-col mt-4">
            <label>Limit</label>
            <Input value={limit} onChange={handleChange('limit')} inputClassName="rounded" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
