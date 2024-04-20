// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import classNames from 'classnames';
import Select2 from '@plitzi/plitzi-ui-components/Select2';
import Button from '@plitzi/plitzi-ui-components/Button';

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
        className={classNames('rounded', { 'opacity-70': !isEditorVisible })}
        onClick={onClickEditorVisible}
      >
        <i className="fas fa-code" />
      </Button>
      <Select2
        className="rounded w-[150px]"
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

TransformLayout.propTypes = {
  layoutMode: PropTypes.string,
  isEditorVisible: PropTypes.bool,
  onClickEditorVisible: PropTypes.func,
  onLayoutModeChange: PropTypes.func
};

export default TransformLayout;
