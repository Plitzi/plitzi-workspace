// Packages
import React, { memo, useCallback, use, useState } from 'react';
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
} from '@plitzi/sdk-shared/style';

// Relatives
import SpacingMargin from './SpacingMargin';
import SpacingEditor from './SpacingEditor';
import StyleInspectorContext from '../../StyleInspectorContext';
import CategoryContainer from '../../../components/CategoryContainer';
import useInspectorValues from '../../hooks/useInspectorValues';

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

/**
 * @param {{
 *   isCollapsed?: boolean;
 *   onCollapse?: (type: string, isCollapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Spacing = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const [isLinked, setIsLinked] = useState(false);
  const { setValue } = use(StyleInspectorContext);
  const values = useInspectorValues({ keys: dotKeys, asValue: true });
  const [fragmentSelected, setFragmentSelected] = useState();

  const handleChangeLink = useCallback(() => setIsLinked(state => !state), [setIsLinked]);

  const handleChange = useCallback(
    (type, partialValue) => {
      if (!isLinked) {
        setValue(type, partialValue);

        return;
      }

      if ([MARGIN_TOP, MARGIN_BOTTOM, MARGIN_LEFT, MARGIN_RIGHT].includes(type)) {
        setValue([MARGIN_TOP, MARGIN_BOTTOM, MARGIN_LEFT, MARGIN_RIGHT], {
          [MARGIN_TOP]: partialValue,
          [MARGIN_BOTTOM]: partialValue,
          [MARGIN_LEFT]: partialValue,
          [MARGIN_RIGHT]: partialValue
        });
      }

      if ([PADDING_TOP, PADDING_BOTTOM, PADDING_LEFT, PADDING_RIGHT].includes(type)) {
        setValue([PADDING_TOP, PADDING_BOTTOM, PADDING_LEFT, PADDING_RIGHT], {
          [PADDING_TOP]: partialValue,
          [PADDING_BOTTOM]: partialValue,
          [PADDING_LEFT]: partialValue,
          [PADDING_RIGHT]: partialValue
        });
      }
    },
    [isLinked, setValue]
  );

  const handleSelectFragment = useCallback(
    fragmentSelected => setFragmentSelected(fragmentSelected),
    [setFragmentSelected]
  );

  const handleCollapse = useCallback(isCollapsed => onCollapse('spacing', isCollapsed), [onCollapse]);

  return (
    <CategoryContainer title="Spacing" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col p-2">
        <SpacingMargin
          values={values}
          fragmentSelected={fragmentSelected}
          onSelectFragment={handleSelectFragment}
          isLinked={isLinked}
          onLinkSelected={handleChangeLink}
        />
        {fragmentSelected && (
          <SpacingEditor fragmentSelected={fragmentSelected} onChange={handleChange} value={values[fragmentSelected]} />
        )}
      </div>
    </CategoryContainer>
  );
};

export default memo(Spacing);
