import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Switch from '@plitzi/plitzi-ui/Switch';
import get from 'lodash/get';
import { useCallback, useMemo } from 'react';

// import DisplayFlexChild from '../Categories/DisplayFlexChild';
import Display from '../categories/Display';
// import Spacing from '../Categories/Spacing';
// import Size from '../Categories/Size';
import List from '../categories/List';
import ListItem from '../categories/ListItem';
// import Position from '../Categories/Position';
// import Typography from '../Categories/Typography';
// import Background from '../Categories/Background';
// import Border from '../Categories/Border';
// import Effects from '../Categories/Effects';
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
    'builder-state.StyleInspector.collapsedCache',
    {}
  );
  const [showAllOptions, setShowAllOptions] = useStorage<boolean>('builder-state.StyleInspector.showAllOptions', false);
  const inheritData = useStyleInherit({ element, selector, styleSelector });

  const handleChangeCollapse = useCallback(
    (id: string, isCollapsed: boolean) => setCollapsedCache(state => ({ ...state, [id]: isCollapsed })),
    [setCollapsedCache]
  );

  const handleChangeShowAllOptions = useCallback(
    (e: ChangeEvent) => setShowAllOptions((e.target as HTMLInputElement).checked),
    [setShowAllOptions]
  );

  const isList = useMemo(() => {
    if (showAllOptions) {
      return true;
    }

    const type = get(element, 'definition.type', '');

    return type === 'list' || type === 'listItem';
  }, [element, showAllOptions]);

  // const isFlexChild = useMemo(() => {
  //   if (showAllOptions) {
  //     return true;
  //   }

  //   return get(inheritData, 'parentStyle.display', 'block') === 'flex';
  // }, [inheritData, showAllOptions]);

  // const isFlexVertical = useMemo(
  //   () => get(inheritData, 'parentStyle.flex-direction', 'row') === 'column',
  //   [inheritData]
  // );

  return (
    <StyleInspectorProvider
      displayMode={displayMode}
      styleSelector={styleSelector}
      selector={selector}
      element={element}
      inheritData={inheritData}
    >
      <div className="flex flex-col justify-between grow">
        <div className="flex flex-col">
          {isList && <List isCollapsed={collapsedCache.list ?? true} onCollapse={handleChangeCollapse} />}
          {isList && <ListItem isCollapsed={collapsedCache.listItem ?? true} onCollapse={handleChangeCollapse} />}
          <Display isCollapsed={collapsedCache.display ?? true} onCollapse={handleChangeCollapse} />
          {/* {isFlexChild && (
            <DisplayFlexChild
              isCollapsed={collapsedCache.displayFlexChild ?? true}
              isFlexVertical={isFlexVertical}
              onCollapse={handleChangeCollapse}
            />
          )}
          <Spacing isCollapsed={collapsedCache.spacing ?? true} onCollapse={handleChangeCollapse} />
          <Size isCollapsed={collapsedCache.size ?? true} onCollapse={handleChangeCollapse} />
          <Position isCollapsed={collapsedCache.position ?? true} onCollapse={handleChangeCollapse} />
          <Typography isCollapsed={collapsedCache.typography ?? true} onCollapse={handleChangeCollapse} />
          <Background isCollapsed={collapsedCache.background ?? true} onCollapse={handleChangeCollapse} />
          <Border isCollapsed={collapsedCache.border ?? true} onCollapse={handleChangeCollapse} />
          <Effects isCollapsed={collapsedCache.effects ?? true} onCollapse={handleChangeCollapse} /> */}
        </div>
        <div className="flex items-center justify-end px-2 py-1 gap-2 text-xs">
          Show All Options
          <Switch className="!w-auto" size="sm" checked={showAllOptions} onChange={handleChangeShowAllOptions} />
        </div>
      </div>
    </StyleInspectorProvider>
  );
};

export default InspectorModeBasic;
