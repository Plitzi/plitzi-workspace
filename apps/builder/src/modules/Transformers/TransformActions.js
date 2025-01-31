// Packages
import React, { useMemo } from 'react';
import Select2 from '@plitzi/plitzi-ui-components/Select2';
import Button from '@plitzi/plitzi-ui-components/Button';
import noop from 'lodash/noop';

/**
 * @param {{
 *   className?: string;
 *   mode?: string;
 *   disabled?: boolean;
 *   onChangeMode?: (mode: string) => void;
 *   onClickEraser?: () => void;
 *   onTransform?: () => void;
 *   onImport?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const TransformActions = props => {
  const {
    mode = 'horizontal',
    disabled,
    onChangeMode = noop,
    onClickEraser = noop,
    onTransform = noop,
    onImport = noop
  } = props;

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
      <Button size="sm" className="rounded-sm" title="Clean Up" onClick={onClickEraser}>
        <i className="fa-solid fa-eraser" />
      </Button>
      <Select2
        className="rounded-sm w-[150px]"
        size="sm"
        placeholder="Select mode"
        value={mode}
        onChange={onChangeMode}
        options={options}
        isSearchable={false}
        isClearable={false}
      />
      <Button size="sm" className="rounded-sm" disabled={disabled} onClick={onTransform} title="Transform">
        {disabled ? 'Loading...' : 'Compile'}
      </Button>
      <Button size="sm" className="rounded-sm" disabled={disabled} onClick={onImport} title="Import">
        Import
      </Button>
    </div>
  );
};

export default TransformActions;
