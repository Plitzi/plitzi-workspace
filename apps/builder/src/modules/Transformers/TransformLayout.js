// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Select2 from '@plitzi/plitzi-ui-components/Select2';

const TransformLayout = props => {
  const { layoutMode = 'horizontal', onLayoutModeChange = noop } = props;
  const optionsLayoutMode = useMemo(
    () => [
      { value: 'horizontal', label: 'Horizontal' },
      { value: 'vertical', label: 'Vertical' }
    ],
    []
  );

  return (
    <div className="flex gap-2">
      <Select2
        className="rounded w-[150px]"
        placeholder="Layout Mode"
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
  onLayoutModeChange: PropTypes.func
};

export default TransformLayout;
