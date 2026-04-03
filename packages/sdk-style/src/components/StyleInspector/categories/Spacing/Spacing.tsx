import { memo, useCallback, use, useState } from 'react';

import SpacingEditor from './SpacingEditor';
import SpacingMargin from './SpacingMargin';
import CategoryContainer from '../../components/CategoryContainer';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = [
  'margin-top',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'padding-top',
  'padding-bottom',
  'padding-left',
  'padding-right'
] as StyleCategory[];

export type SpacingProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Spacing = ({ replaceTokens = false, isCollapsed = true, onCollapse }: SpacingProps) => {
  const [isLinked, setIsLinked] = useState(false);
  const { setValue } = use(StyleInspectorContext);
  const values = useInspectorValues({ keys: dotKeys, asValue: true, replaceTokens });
  const [fragmentSelected, setFragmentSelected] = useState<StyleCategory | undefined>();

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('spacing', isCollapsed), [onCollapse]);

  const handleChangeLink = useCallback(() => setIsLinked(state => !state), [setIsLinked]);

  const handleChange = useCallback(
    (type: StyleCategory, partialValue: StyleValue) => {
      if (!isLinked) {
        setValue(type, partialValue);

        return;
      }

      if (['margin-top', 'margin-bottom', 'margin-left', 'margin-right'].includes(type)) {
        setValue(undefined, {
          'margin-top': partialValue,
          'margin-bottom': partialValue,
          'margin-left': partialValue,
          'margin-right': partialValue
        });
      }

      if (['padding-top', 'padding-bottom', 'padding-left', 'padding-right'].includes(type)) {
        setValue(undefined, {
          'padding-top': partialValue,
          'padding-bottom': partialValue,
          'padding-left': partialValue,
          'padding-right': partialValue
        });
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
      <div className="flex flex-col">
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
