import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Switch from '@plitzi/plitzi-ui/Switch';
import get from 'lodash-es/get.js';
import { useCallback, useMemo } from 'react';

import Background from '../categories/Background';
import Border from '../categories/Border';
import Display from '../categories/Display';
import DisplayFlexChild from '../categories/DisplayFlexChild';
import Effects from '../categories/Effects';
import List from '../categories/List';
import ListItem from '../categories/ListItem';
import Position from '../categories/Position';
import Size from '../categories/Size';
import Spacing from '../categories/Spacing';
import Typography from '../categories/Typography';
import useStyleInherit from '../hooks/useStyleInherit';
import StyleInspectorProvider from '../StyleInspectorProvider';

import type { DisplayMode, Element } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type InspectorModeBasicProps = {
  selector?: string;
  styleSelector?: string;
  element?: Element;
  displayMode: DisplayMode;
};

const InspectorModeBasic = ({
  selector = '',
  styleSelector = 'base',
  element,
  displayMode
}: InspectorModeBasicProps) => {
  const [collapsedCache, setCollapsedCache] = useStorage<Record<string, boolean | undefined>>(
    'builder-state.styleInspector.collapsedCache',
    {}
  );
  const [showAllOptions, setShowAllOptions] = useStorage<boolean>('builder-state.styleInspector.showAllOptions', false);
  const [replaceTokens, setReplaceTokens] = useStorage<boolean>('builder-state.styleInspector.replaceTokens', false);
  const inheritData = useStyleInherit({ element, selector, styleSelector });

  const handleChangeCollapse = useCallback(
    (id: string, isCollapsed: boolean) => setCollapsedCache(state => ({ ...state, [id]: isCollapsed })),
    [setCollapsedCache]
  );

  const handleChangeShowAllOptions = useCallback(
    (e: ChangeEvent) => setShowAllOptions((e.target as HTMLInputElement).checked),
    [setShowAllOptions]
  );

  const handleChangeReplaceTokens = useCallback(
    (e: ChangeEvent) => setReplaceTokens((e.target as HTMLInputElement).checked),
    [setReplaceTokens]
  );

  const isList = useMemo(() => {
    if (showAllOptions) {
      return true;
    }

    const type = get(element, 'definition.type', '');

    return type === 'list' || type === 'listItem';
  }, [element, showAllOptions]);

  const isFlexChild = useMemo(() => {
    if (showAllOptions) {
      return true;
    }

    return get(inheritData, 'parentStyle.display', 'block') === 'flex';
  }, [inheritData, showAllOptions]);

  const isFlexVertical = useMemo(
    () => get(inheritData, 'parentStyle.flex-direction', 'row') === 'column',
    [inheritData]
  );

  return (
    <StyleInspectorProvider
      displayMode={displayMode}
      styleSelector={styleSelector}
      selector={selector}
      element={element}
      inheritData={inheritData}
    >
      <div className="flex grow flex-col justify-between">
        <div className="flex flex-col gap-1">
          {isList && (
            <List
              replaceTokens={replaceTokens}
              isCollapsed={collapsedCache.list ?? true}
              onCollapse={handleChangeCollapse}
            />
          )}
          {isList && (
            <ListItem
              replaceTokens={replaceTokens}
              isCollapsed={collapsedCache.listItem ?? true}
              onCollapse={handleChangeCollapse}
            />
          )}
          <Display
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.display ?? true}
            onCollapse={handleChangeCollapse}
          />
          {isFlexChild && (
            <DisplayFlexChild
              replaceTokens={replaceTokens}
              isCollapsed={collapsedCache.displayFlexChild ?? true}
              isFlexVertical={isFlexVertical}
              onCollapse={handleChangeCollapse}
            />
          )}
          <Spacing
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.spacing ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Size
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.size ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Position
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.position ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Typography
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.typography ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Background
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.background ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Border
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.border ?? true}
            onCollapse={handleChangeCollapse}
          />
          <Effects
            replaceTokens={replaceTokens}
            isCollapsed={collapsedCache.effects ?? true}
            onCollapse={handleChangeCollapse}
          />
        </div>
        <div className="flex items-center justify-end gap-4 px-2 py-1">
          <Switch size="xs" label="Replace Tokens" checked={replaceTokens} onChange={handleChangeReplaceTokens} />
          <Switch size="xs" label="Show All Options" checked={showAllOptions} onChange={handleChangeShowAllOptions} />
        </div>
      </div>
    </StyleInspectorProvider>
  );
};

export default InspectorModeBasic;
