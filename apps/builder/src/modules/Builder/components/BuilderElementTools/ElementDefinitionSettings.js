// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import get from 'lodash/get';
import startCase from 'lodash/startCase';
import Input from '@plitzi/plitzi-ui-components/Input';
import Select from '@plitzi/plitzi-ui-components/Select';

// Relatives
import { emptyObject } from '../../../../helpers/utils';

const ElementDefinitionSettings = props => {
  const { type = '', definition = emptyObject, onUpdate = noop } = props;
  const { label, initialState } = definition;
  const visibility = useMemo(() => (get(initialState, 'visibility', true) ? 'true' : 'false'), [initialState]);

  const handleChangeLabel = useCallback(e => onUpdate('label', e.target.value, true), [onUpdate]);

  const handleChangeVisibility = useCallback(
    e => onUpdate('initialState', { ...initialState, visibility: e.target.value === 'true' }, true),
    [onUpdate, initialState]
  );

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">{startCase(type)} Definition</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Element Name</label>
          <Input value={label} onChange={handleChangeLabel} inputClassName="rounded" />
        </div>
        <div className="flex flex-col mt-4">
          <label>Visibility</label>
          <Select value={visibility} onChange={handleChangeVisibility} className="rounded">
            <option value="true">Visible</option>
            <option value="false">Not Visible</option>
          </Select>
        </div>
      </div>
    </div>
  );
};

ElementDefinitionSettings.propTypes = {
  type: PropTypes.string,
  definition: PropTypes.object,
  onUpdate: PropTypes.func
};

export default ElementDefinitionSettings;
