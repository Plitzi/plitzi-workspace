import { memo, useCallback, use, useState } from 'react';

import {
  MARGIN_TOP,
  MARGIN_BOTTOM,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  PADDING_TOP,
  PADDING_BOTTOM,
  PADDING_LEFT,
  PADDING_RIGHT
} from '@plitzi/sdk-shared/style/StyleConstants';

import SpacingEditor from './SpacingEditor';
import SpacingMargin from './SpacingMargin';
import CategoryContainer from '../../components/CategoryContainer';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = [
  MARGIN_TOP,
  MARGIN_BOTTOM,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  PADDING_TOP,
  PADDING_BOTTOM,
  PADDING_LEFT,
  PADDING_RIGHT
] as StyleCategory[];

export type SpacingProps = {
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Spacing = ({ isCollapsed = true, onCollapse }: SpacingProps) => {
  const [isLinked, setIsLinked] = useState(false);
  const { setValue } = use(StyleInspectorContext);
  const values = useInspectorValues({ keys: dotKeys, asValue: true });
  const [fragmentSelected, setFragmentSelected] = useState<StyleCategory | undefined>();

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('spacing', isCollapsed), [onCollapse]);

  const handleChangeLink = useCallback(() => setIsLinked(state => !state), [setIsLinked]);

  const handleChange = useCallback(
    (type: StyleCategory, partialValue: StyleValue) => {
      if (!isLinked) {
        setValue(type, partialValue);

        return;
      }

      if ([MARGIN_TOP, MARGIN_BOTTOM, MARGIN_LEFT, MARGIN_RIGHT].includes(type)) {
        setValue(
          [MARGIN_TOP, MARGIN_BOTTOM, MARGIN_LEFT, MARGIN_RIGHT] as const,
          {
            [MARGIN_TOP]: partialValue,
            [MARGIN_BOTTOM]: partialValue,
            [MARGIN_LEFT]: partialValue,
            [MARGIN_RIGHT]: partialValue
          } as Record<StyleCategory, StyleValue | undefined>
        );
      }

      if ([PADDING_TOP, PADDING_BOTTOM, PADDING_LEFT, PADDING_RIGHT].includes(type)) {
        setValue(
          [PADDING_TOP, PADDING_BOTTOM, PADDING_LEFT, PADDING_RIGHT] as const,
          {
            [PADDING_TOP]: partialValue,
            [PADDING_BOTTOM]: partialValue,
            [PADDING_LEFT]: partialValue,
            [PADDING_RIGHT]: partialValue
          } as Record<StyleCategory, StyleValue | undefined>
        );
      }
    },
    [isLinked, setValue]
  );

  const handleSelectFragment = useCallback(
    (fragmentSelected?: StyleCategory) => setFragmentSelected(fragmentSelected),
    [setFragmentSelected]
  );

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
