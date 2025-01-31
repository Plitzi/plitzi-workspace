// Packages
import React, { useMemo } from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';
import Select2 from '@plitzi/plitzi-ui-components/Select2';
import Button from '@plitzi/plitzi-ui-components/Button';

/**
 * @param {{
 *   layoutMode?: string;
 *   isEditorVisible?: boolean;
 *   onClickEditorVisible?: () => void;
 *   onLayoutModeChange?: (value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const TransformLayout = props => {
  const {
    layoutMode = 'horizontal',
    isEditorVisible = true,
    onClickEditorVisible = noop,
    onLayoutModeChange = noop
  } = props;
  const optionsLayoutMode = useMemo(
    () => [
      { value: 'horizontal', label: 'Horizontal' },
      { value: 'vertical', label: 'Vertical' }
    ],
    []
  );

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        title="Hide/Show Editor"
        className={classNames('rounded-sm', { 'opacity-70': !isEditorVisible })}
        onClick={onClickEditorVisible}
      >
        <i className="fas fa-code" />
      </Button>
      <Select2
        className="rounded-sm w-[150px]"
        isClearable={false}
        isSearchable={false}
        value={layoutMode}
        onChange={onLayoutModeChange}
        size="sm"
        options={optionsLayoutMode}
      />
    </div>
  );
};

export default TransformLayout;
