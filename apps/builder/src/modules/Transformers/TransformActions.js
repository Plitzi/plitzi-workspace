// Packages
import React, { useMemo } from 'react';
import Select2 from '@plitzi/plitzi-ui-components/Select2';
import Button from '@plitzi/plitzi-ui-components/Button';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

const TransformActions = props => {
  const { mode = 'horizontal', disabled, onChangeMode = noop, onTransform = noop, onImport = noop } = props;

  const options = useMemo(
    () => [
      // { value: 'html', label: 'Html' },
      { value: 'html-tailwind', label: 'Html + Tailwind' },
      // { value: 'json', label: 'Json' },
      { value: 'webflow', label: 'Webflow' }
    ],
    []
  );

  return (
    <div className="flex gap-2">
      <Select2
        className="rounded w-[150px]"
        size="sm"
        placeholder="Select mode"
        value={mode}
        onChange={onChangeMode}
        options={options}
        isSearchable={false}
        isClearable={false}
      />
      <Button size="sm" className="rounded" disabled={disabled} onClick={onTransform} title="Transform">
        {disabled ? 'Loading...' : 'Compile'}
      </Button>
      <Button size="sm" className="rounded" disabled={disabled} onClick={onImport} title="Import">
        Import
      </Button>
    </div>
  );
};

TransformActions.propTypes = {
  className: PropTypes.string,
  mode: PropTypes.string,
  disabled: PropTypes.bool,
  onChangeMode: PropTypes.func,
  onTransform: PropTypes.func,
  onImport: PropTypes.func
};

export default TransformActions;
