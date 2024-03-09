// Packages
import React, { memo, useCallback, useContext, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Monorepo
import {
  MARGIN_TOP,
  MARGIN_BOTTOM,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  PADDING_TOP,
  PADDING_BOTTOM,
  PADDING_LEFT,
  PADDING_RIGHT
} from '@plitzi/sdk-style/StyleConstants';

// Relatives
import SpacingMargin from './SpacingMargin';
import SpacingEditor from './SpacingEditor';
import StyleInspectorContext from '../../StyleInspectorContext';
import CategoryContainer from '../../../components/CategoryContainer';

const dotKeys = [
  MARGIN_TOP,
  MARGIN_BOTTOM,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  PADDING_TOP,
  PADDING_BOTTOM,
  PADDING_LEFT,
  PADDING_RIGHT
];

const Spacing = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { getValue, setValue } = useContext(StyleInspectorContext);
  const [fragmentSelected, setFragmentSelected] = useState();

  const handleChange = (type, partialValue) => {
    setValue(type, partialValue);
  };

  const handleSelectFragment = useCallback(
    fragmentSelected => setFragmentSelected(fragmentSelected),
    [setFragmentSelected]
  );

  const handleCollapse = useCallback(isCollapsed => onCollapse('spacing', isCollapsed), [onCollapse]);

  const margin = getValue([MARGIN_TOP, MARGIN_BOTTOM, MARGIN_LEFT, MARGIN_RIGHT]);
  const padding = getValue([PADDING_TOP, PADDING_BOTTOM, PADDING_LEFT, PADDING_RIGHT]);

  return (
    <CategoryContainer title="Spacing" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col p-2">
        <SpacingMargin
          partialValue={margin}
          padding={padding}
          fragmentSelected={fragmentSelected}
          onSelectFragment={handleSelectFragment}
        />
        {fragmentSelected && (
          <SpacingEditor
            fragmentSelected={fragmentSelected}
            onChange={handleChange}
            partialValue={getValue(fragmentSelected)}
          />
        )}
      </div>
    </CategoryContainer>
  );
};

Spacing.propTypes = {
  isCollapsed: PropTypes.bool,
  onCollapse: PropTypes.func
};

export default memo(Spacing);
